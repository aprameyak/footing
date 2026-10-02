import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      skills: true,
      learningGoals: true,
      interests: true,
      repositoryInterests: true,
      skillEvidence: true,
    },
  });
  if (!user) {
    redirect("/login");
  }
  return { session, user };
}

/** Server-only GitHub token: DB OAuth token, else optional GITHUB_TOKEN. */
export async function getGithubToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessToken: true },
  });
  return user?.accessToken || process.env.GITHUB_TOKEN || null;
}
