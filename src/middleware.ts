import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * First line of defence only: checks the token signature and coarse role.
 * Every admin page, server action and API route repeats the full check on the server
 * (account still active, session not revoked, MFA done, permission granted).
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  const needsLogin = pathname.startsWith("/account") || pathname.startsWith("/checkout") || pathname.startsWith("/orders");
  const isAdmin = pathname.startsWith("/admin");

  if ((needsLogin || isAdmin) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (isAdmin && session && session.role !== "ADMIN" && session.role !== "STAFF") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const res = NextResponse.next();
  if (isAdmin) res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  // Node.js runtime: the session check reads settings that Prisma Compute provides through the Composer service.
  runtime: "nodejs",
  matcher: ["/account/:path*", "/checkout/:path*", "/orders/:path*", "/admin/:path*"],
};
