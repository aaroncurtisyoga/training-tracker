import { NextResponse } from "next/server";

/**
 * Route-handler guard for Vercel Cron endpoints. Returns a 401 Response when
 * the request lacks the `Bearer ${CRON_SECRET}` authorization header, else null.
 */
export function assertCronRequest(request: Request): NextResponse | null {
  // Without this guard, an env missing CRON_SECRET would accept the literal
  // header "Bearer undefined".
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
