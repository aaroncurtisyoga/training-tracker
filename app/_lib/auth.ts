import { auth } from "@clerk/nextjs/server";

/**
 * Guard for admin-only server actions.
 *
 * Standardized on `sessionClaims.metadata.role` to match proxy.ts, which gates
 * every route on this origin except /sign-in and /api/cron, and to skip the
 * extra network round-trip that currentUser() would add. Throws on failure so
 * callers can let handleError() surface it.
 *
 * There is no Response-returning twin here. The only route handler is the
 * Garmin cron endpoint, which authenticates with assertCronRequest() instead.
 */
export async function requireAdmin(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (sessionClaims?.metadata?.role !== "admin") {
    throw new Error("Unauthorized: admin role required");
  }
  return userId;
}
