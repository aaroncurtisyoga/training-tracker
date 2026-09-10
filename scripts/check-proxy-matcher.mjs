/**
 * Asserts what proxy.ts's config.matcher does and does not gate.
 *
 * This exists because the matcher is the only thing standing between an
 * unauthenticated request and every route on this origin, and its failure mode
 * is silent: a pattern that stops matching just means the proxy never runs.
 *
 * The specific trap it guards against: Next appends an optional transport
 * suffix (.rsc, .json, .segments/...) to every matcher source so the proxy keeps
 * covering the RSC form of a route. A leading "(?!.*\..*)" is tested against the
 * whole remaining path and rejects the request before that suffix can be split
 * off, so the compiled matcher stops covering those forms and nothing surfaces
 * it. Measured caveat: on Vercel the suffix form still reached the proxy in
 * practice, so this is about the matcher meaning what it says rather than about
 * a hole that was open in production.
 *
 * Run: node scripts/check-proxy-matcher.mjs   (wired into `npm run check`)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getMiddlewareMatchers } from "next/dist/build/analysis/get-page-static-info.js";

// Read the live matcher out of proxy.ts rather than duplicating it here, so the
// test cannot pass against a copy that has drifted from the shipped config.
const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const block = source.match(/matcher:\s*\[([\s\S]*?)\]/);
assert.ok(block, "could not find config.matcher in proxy.ts");
const patterns = [...block[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
  m[1].replace(/\\\\/g, "\\"),
);
assert.ok(patterns.length > 0, "no matcher patterns parsed out of proxy.ts");

const regexes = getMiddlewareMatchers(patterns, {}).map(
  (m) => new RegExp(m.regexp),
);
const gated = (p) => regexes.some((r) => r.test(p));

const MUST_GATE = [
  "/",
  "/trends",
  "/log/abc123",
  // RSC transport forms of the same routes: a client-side navigation.
  "/trends.rsc",
  "/log/abc123.rsc",
  "/trends.segments/x.segment.rsc",
  "/sign-in.rsc",
  // A dynamic id that happens to contain a dot is still a route, not an asset.
  "/log/photo.png",
];

const MUST_SKIP = [
  // Authenticated by CRON_SECRET instead. If the proxy ever runs here the cron
  // follows a 307 to /sign-in and returns 200 HTML, so assertCronRequest never
  // runs and Vercel logs a success while the Garmin import silently stops.
  "/api/cron/sync-garmin",
  "/_next/static/chunk.js",
  "/_next/image",
  "/icons/icon-192x192.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/favicon.ico",
];

for (const p of MUST_GATE) {
  assert.equal(gated(p), true, `proxy must run for ${p}, but the matcher skips it`);
}
for (const p of MUST_SKIP) {
  assert.equal(gated(p), false, `proxy must NOT run for ${p}, but the matcher gates it`);
}

console.log(
  `proxy matcher OK: ${MUST_GATE.length} gated, ${MUST_SKIP.length} skipped`,
);
