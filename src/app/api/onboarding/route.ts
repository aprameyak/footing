import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const schema = z.object({
  skills: z.array(z.string().min(1)).default([]),
  learningGoals: z.array(z.string().min(1)).default([]),
  interests: z.array(z.string().min(1)).default([]),
  repositories: z.array(z.string().min(1)).default([]),
  challengePref: z.enum(["comfortable", "stretch", "challenge"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await req.json());
  const userId = session.user.id;

  await prisma.$transaction([
    prisma.userSkill.deleteMany({ where: { userId } }),
    prisma.userLearningGoal.deleteMany({ where: { userId } }),
    prisma.userInterest.deleteMany({ where: { userId } }),
    prisma.userRepositoryInterest.deleteMany({ where: { userId } }),
  ]);

  if (body.skills.length) {
    await prisma.userSkill.createMany({
      data: body.skills.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
  }
  if (body.learningGoals.length) {
    await prisma.userLearningGoal.createMany({
      data: body.learningGoals.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
  }
  if (body.interests.length) {
    await prisma.userInterest.createMany({
      data: body.interests.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
  }

  for (const raw of body.repositories) {
    const fullName = raw
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "");
    if (!fullName.includes("/")) continue;
    await prisma.userRepositoryInterest.upsert({
      where: { userId_fullName: { userId, fullName } },
      create: { userId, fullName },
      update: {},
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardedAt: new Date(),
      challengePref: body.challengePref || "comfortable",
    },
  });

  return NextResponse.json({ ok: true });
}
