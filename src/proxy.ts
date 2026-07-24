import { NextRequest, NextResponse } from "next/server";

/** Set this on the SERVER (Pterodactyl/Back4app/Render) deployment to the
 *  exact URL of your Vercel-hosted UI, e.g. "https://zales.vercel.app" —
 *  needed because browsers block cross-origin requests unless the server
 *  explicitly allows the calling origin. Leave unset ("*") while both UI
 *  and API run from the same deployment (the normal single-deployment
 *  case), since there's no cross-origin request to worry about then. */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";

export function proxy(req: NextRequest) {
  const isPreflight = req.method === "OPTIONS";
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGIN || origin || "*";

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Credentials", "true");

  if (isPreflight) {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  headers.forEach((value, key) => res.headers.set(key, value));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
