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

export async function getAccessToken() {
  const session = await auth();
  return session?.accessToken || process.env.GITHUB_TOKEN || null;
}
