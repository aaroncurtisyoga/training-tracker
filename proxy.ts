import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isSignInRoute = createRouteMatcher(["/sign-in(.*)"]);

/**
 * Exact-match origin allowlist for Clerk's `azp` claim, which is what stops a
 * token minted for another subdomain of aaroncurtisyoga.com from being replayed
 * here. There is no wildcard support, so every host that legitimately serves
 * this instance has to be listed by name. A missing entry 401s that host on
 * every authenticated request.
 */
const previewOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`);

const authorizedParties = [
  "https://train.aaroncurtisyoga.com",
  "https://aaroncurtisyoga.com",
  "https://www.aaroncurtisyoga.com",
  // Gate on VERCEL_ENV, not NODE_ENV: `next start` and every preview build set
  // NODE_ENV=production too, and on an origin Clerk won't accept, auth() returns
  // no userId, we 307 to /sign-in, clerk-js sees a live session and bounces back
  // to "/", and those two redirects loop forever.
  ...(process.env.VERCEL_ENV === "production"
    ? []
    : ["http://localhost:3000", ...previewOrigins]),
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
  // HTML, so assertCronRequest never runs, Vercel's cron log shows success, and
  // the import silently stops.
  //
  // Exclude asset paths by name rather than "any path containing a dot". Next
  // appends an optional transport suffix (.rsc, .json, .segments/...) to every
  // matcher source so the proxy keeps covering the RSC form of a route, but a
  // leading (?!.*\..*) is tested against the whole remaining path and rejects
  // the request before that suffix can be split off. The effect of the dot form
  // is that every client-side navigation skips the proxy.
  matcher: [
    "/((?!_next/|icons/|manifest\\.webmanifest|robots\\.txt|favicon\\.ico|api/cron/).*)",
    "/",
  ],
};
