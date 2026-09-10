import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isSignInRoute = createRouteMatcher(["/sign-in(.*)"]);

/**
 * Exact-match origin allowlist for Clerk's `azp` claim, which is what stops a
 * token minted for another subdomain of aaroncurtisyoga.com from being replayed
 * here. There is no wildcard support, so every host that legitimately serves
 * this instance has to be listed by name — a missing entry 401s that host on
 * every authenticated request.
 */
const authorizedParties = [
  "https://train.aaroncurtisyoga.com",
  "https://aaroncurtisyoga.com",
  "https://www.aaroncurtisyoga.com",
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
];

export default clerkMiddleware(
  async (auth, req) => {
    if (isSignInRoute(req)) return NextResponse.next();

    const { userId, sessionClaims } = await auth();

    // Not signed in → prompt for login and come back. This has to run before
    // the role check, otherwise a signed-out visitor gets a bare 404 with no
    // way to authenticate.
    if (!userId) {
      const url = req.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set(
        "redirect_url",
        req.nextUrl.pathname + req.nextUrl.search,
      );
      return NextResponse.redirect(url);
    }

    // Signed in but not the owner. 404 rather than 403: this host has exactly
    // one legitimate user, so there is nothing to explain to anyone else.
    if (sessionClaims?.metadata?.role !== "admin") {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.next();
  },
  { authorizedParties },
);

export const config = {
  // The api/cron/ exclusion is load-bearing. Without it the nightly Garmin cron
  // hits the admin gate, gets a 307 to /sign-in, follows it, and returns 200
  // HTML — so assertCronRequest never runs, Vercel's cron log shows success,
  // and the import silently stops. The dot-exclusion keeps public/ assets and
  // the webmanifest servable without auth.
  matcher: ["/((?!.*\\..*|_next|api/cron/).*)", "/", "/api/((?!cron/).*)"],
};
