import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const userId = (req.auth?.user as { id?: string } | undefined)?.id;
  const isLoggedIn = Boolean(userId || req.auth?.user);
  const isPublic =
    path === "/login" ||
    path.startsWith("/api/auth") ||
    path === "/";

  if (!isLoggedIn && !isPublic && !path.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isLoggedIn && path === "/login") {
    return NextResponse.redirect(new URL("/feed", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
