import { Workspace } from "@/components/contribution/Workspace";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireUser();
  const { id } = await params;

  const contribution = await prisma.contribution.findFirst({
    where: { id, userId: user.id },
    include: {
      checklistItems: { orderBy: { sortOrder: "asc" } },
      stages: true,
      blockers: { orderBy: { createdAt: "desc" } },
      pullRequests: true,
      outcomes: { orderBy: { createdAt: "desc" } },
      opportunity: {
        include: {
          repository: { include: { analysis: true } },
          issue: { include: { analysis: true, labels: true } },
          matchReasons: { where: { userId: user.id } },
        },
      },
    },
  });

  if (!contribution) notFound();

  const payload = JSON.parse(
    JSON.stringify(contribution, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    )
  );

  return <Workspace data={payload} />;
}
