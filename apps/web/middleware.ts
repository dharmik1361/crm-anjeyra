import { NextResponse, type NextRequest } from "next/server";

export const COOKIE = "qf_admin";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/login")) return NextResponse.next();
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
