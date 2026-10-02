import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "@/lib/auth/config";

const providers = [];

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    })
  );
}

function devLoginAllowed() {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.ENABLE_DEV_LOGIN === "true" || !process.env.GITHUB_CLIENT_ID
  );
}

if (devLoginAllowed()) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        login: { label: "Login", type: "text" },
      },
      async authorize(credentials) {
        const login =
          String(credentials?.login || "devuser").replace(
            /[^a-zA-Z0-9_-]/g,
            ""
          ) || "devuser";
        const user = await prisma.user.upsert({
          where: { githubId: `dev:${login}` },
          create: {
            githubId: `dev:${login}`,
            login,
            name: login,
            email: `${login}@localhost`,
            avatarUrl: null,
          },
          update: {
            login,
            name: login,
          },
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
        };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubId = String((profile as { id?: string | number }).id);
        const login =
          (profile as { login?: string }).login || user.name || "user";
        await prisma.user.upsert({
          where: { githubId },
          create: {
            githubId,
            login,
            name: user.name || login,
            email: user.email || null,
            avatarUrl: user.image || null,
            accessToken: account.access_token || null,
          },
          update: {
            login,
            name: user.name || login,
            email: user.email || undefined,
            avatarUrl: user.image || undefined,
            accessToken: account.access_token || undefined,
          },
        });
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubId = String((profile as { id?: string | number }).id);
        let dbUser = await prisma.user.findUnique({ where: { githubId } });
        if (!dbUser) {
          const login =
            (profile as { login?: string }).login || user?.name || "user";
          dbUser = await prisma.user.create({
            data: {
              githubId,
              login,
              name: user?.name || login,
              email: user?.email || null,
              avatarUrl: user?.image || null,
              accessToken: account.access_token || null,
            },
          });
        }
        token.userId = dbUser.id;
        token.login = dbUser.login;
        token.accessToken = account.access_token;
        return token;
      }
      if (account?.provider === "dev-login" && user?.id) {
        token.userId = user.id;
        token.login = user.name || "devuser";
        return token;
      }
      return token;
    },
  },
});
