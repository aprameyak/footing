import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = Boolean(
        (auth?.user as { id?: string } | undefined)?.id || auth?.user
      );
      if (
        path === "/login" ||
        path.startsWith("/api/auth") ||
        path === "/"
      ) {
        return true;
      }
      if (path.startsWith("/api/")) return true;
      return isLoggedIn;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || "";
        session.user.login = (token.login as string) || session.user.name || "";
      }
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET || "dev-secret-change-me",
} satisfies NextAuthConfig;
