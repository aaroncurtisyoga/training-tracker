/**
 * One-time copy of the six training tables out of the yoga site's database
 * (verceldb) into this app's own database (training). Both live in the same
 * Neon project on the same compute endpoint. Run it at cutover, after the first
 * successful deploy has created the schema with `prisma migrate deploy`.
 *
 * Why it's built this way:
 *
 * - Postgres does every conversion. Each table leaves as json_agg(row) and
 *   arrives through json_populate_recordset, so no date, timestamp, enum or Json
 *   value passes through a JS Date or a driver type parser. That rules out the
 *   @db.Date trap by construction: four columns store a calendar day as UTC
 *   midnight, and a tool that round-trips them through a local-timezone
 *   timestamp shifts every workout by a day with no error. It also sidesteps
 *   Prisma's typed API, which would reject plain null in the three nullable Json
 *   columns and can overwrite @updatedAt on create.
 * - The source runs in a READ ONLY transaction, so no bug here can write to the
 *   yoga site's database.
 * - The target is truncated inside the same transaction as the inserts. The app
 *   self-seeds Movement and PlannedSession rows on first visit, so a target
 *   opened even once would collide on the unique Movement.name. Truncating also
 *   makes the copy safe to re-run.
 * - Verification is an md5 over every row's text form on both sides: a byte-level
 *   comparison, not a row count.
 *
 * Usage. Without --apply it only reads both sides and reports:
 *   npx dotenv-cli -e .env.migrate -- npx tsx scripts/copy-training-data.ts
 *   npx dotenv-cli -e .env.migrate -- npx tsx scripts/copy-training-data.ts --apply
 *
 * .env.migrate is gitignored and holds two DIRECT (non-pooled) URLs:
 *   SOURCE_DATABASE_URL   ending in /verceldb
 *   TARGET_DATABASE_URL   ending in /training
 * Direct, not pooled, because pgbouncer's transaction mode breaks SET LOCAL and
 * the multi-statement transactions this depends on.
 */
import { PrismaClient } from "@prisma/client";

// Dependency order: each table comes after every table it references.
const TABLES = [
  "Movement",
  "PlannedSession",
  "LoggedSession",
  "LoggedMovement",
  "GarminActivity",
  "DailyWellness",
] as const;
type Table = (typeof TABLES)[number];

const APPLY = process.argv.includes("--apply");
const TX = { maxWait: 10_000, timeout: 120_000 };

/**
 * Reads a URL and refuses anything that could point the destructive half of
 * this script at the wrong database. Swapping the two variables would truncate
 * the only copy of the training data, so the database names are checked exactly
 * rather than trusted.
 */
function dbUrl(name: string, expectedDb: string): string {
  const raw = process.env[name];
  if (!raw)
    throw new Error(`${name} is not set. See the usage note in this file.`);
  const u = new URL(raw);
  if (u.hostname.includes("-pooler.")) {
    throw new Error(
      `${name} is a pooled URL. Use the direct (non-pooled) one.`,
    );
  }
  const db = u.pathname.replace(/^\//, "");
  if (db !== expectedDb) {
    throw new Error(
      `${name} points at database "${db}", expected "${expectedDb}".`,
    );
  }
  return raw;
}

// Host and database only. The URL carries a password, so it is never printed.
const where = (raw: string) => {
  const u = new URL(raw);
  return `${u.hostname}${u.pathname}`;
};

type Fingerprint = { rows: number; md5: string };

async function fingerprint(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  table: Table,
): Promise<Fingerprint> {
  const [r] = await db.$queryRawUnsafe<{ rows: number; md5: string }[]>(
    `SELECT count(*)::int AS rows,
            coalesce(md5(string_agg(t::text, '|' ORDER BY t.id)), '') AS md5
       FROM "${table}" t`,
  );
  return r;
}

async function dateHistogram(db: Pick<PrismaClient, "$queryRawUnsafe">) {
  return db.$queryRawUnsafe<{ d: string; n: number }[]>(
    `SELECT date::text AS d, count(*)::int AS n
       FROM "LoggedSession" GROUP BY 1 ORDER BY 1`,
  );
}

async function main() {
  const SOURCE = dbUrl("SOURCE_DATABASE_URL", "verceldb");
  const TARGET = dbUrl("TARGET_DATABASE_URL", "training");
  if (SOURCE === TARGET) throw new Error("Source and target are the same URL.");

  console.log(`source  ${where(SOURCE)}  (read only)`);
  console.log(`target  ${where(TARGET)}`);
  console.log(
    APPLY ? "mode    APPLY\n" : "mode    dry run, nothing is written\n",
  );

  const src = new PrismaClient({ datasourceUrl: SOURCE });
  const dst = new PrismaClient({ datasourceUrl: TARGET });

  try {
    // Read everything from the source in one read-only snapshot.
    const payload = {} as Record<Table, string>;
    const before = {} as Record<Table, Fingerprint>;
    let srcHistogram: { d: string; n: number }[] = [];

    await src.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      for (const t of TABLES) {
        const [{ j }] = await tx.$queryRawUnsafe<{ j: string }[]>(
          `SELECT coalesce(json_agg(t), '[]'::json)::text AS j FROM "${t}" t`,
        );
        payload[t] = j;
        before[t] = await fingerprint(tx, t);
      }
      srcHistogram = await dateHistogram(tx);
    }, TX);

    // The schema has to exist before anything can be written into it.
    const missing: string[] = [];
    for (const t of TABLES) {
      const [{ reg }] = await dst.$queryRawUnsafe<{ reg: string | null }[]>(
        `SELECT to_regclass('"${t}"')::text AS reg`,
      );
      if (!reg) missing.push(t);
    }
    if (missing.length) {
      throw new Error(
        `Target has no ${missing.join(", ")} table. Deploy once so ` +
          "`prisma migrate deploy` creates the schema, then re-run.",
      );
    }

    for (const t of TABLES) {
      const cur = await fingerprint(dst, t);
      console.log(
        `${t.padEnd(16)} source ${String(before[t].rows).padStart(5)}` +
          `   target now ${String(cur.rows).padStart(5)}`,
      );
    }

    if (!APPLY) {
      console.log("\nDry run complete. Re-run with --apply to copy.");
      return;
    }

    await dst.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
      await tx.$executeRawUnsafe(
        `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")}`,
      );
      for (const t of TABLES) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "${t}"
             SELECT * FROM json_populate_recordset(NULL::"${t}", $1::json)`,
          payload[t],
        );
      }
    }, TX);

    // Verify byte for byte against the snapshot we read.
    console.log("\nverify");
    let ok = true;
    for (const t of TABLES) {
      const after = await fingerprint(dst, t);
      const match =
        after.rows === before[t].rows && after.md5 === before[t].md5;
      ok &&= match;
      console.log(
        `${t.padEnd(16)} ${String(after.rows).padStart(5)} rows  ` +
          `${match ? "identical" : "MISMATCH"}`,
      );
    }

    const dstHistogram = await dateHistogram(dst);
    const sameDays =
      JSON.stringify(dstHistogram) === JSON.stringify(srcHistogram);
    ok &&= sameDays;
    console.log(
      `LoggedSession days: ${srcHistogram.length} distinct, ` +
        `${sameDays ? "no shift" : "SHIFTED, the @db.Date trap fired"}`,
    );

    if (!ok) {
      process.exitCode = 1;
      console.error("\nVerification FAILED. Do not cut over.");
    } else {
      console.log("\nCopy verified. Safe to cut over.");
    }
  } finally {
    await Promise.all([src.$disconnect(), dst.$disconnect()]);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
