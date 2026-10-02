import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isLoggedIn = Boolean(req.auth?.user?.id);
  const isPublic =
    path === "/login" ||
    path.startsWith("/api/auth") ||
    path === "/";

  if (!isLoggedIn && !isPublic && !path.startsWith("/api/")) {
    const url = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && path === "/login") {
    return NextResponse.redirect(new URL("/feed", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
