import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deepenOpportunityAnalysis } from "@/lib/github/ingest";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      repository: {
        include: {
          languages: true,
          topics: true,
          analysis: true,
        },
      },
      issue: {
        include: {
          labels: true,
          comments: { orderBy: { createdAtGithub: "asc" }, take: 20 },
          linkedPrs: true,
          analysis: true,
        },
      },
      matchReasons: {
        where: { userId: session.user.id },
        orderBy: { weight: "desc" },
      },
    },
  });

  if (!opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(opportunity);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === "save") {
    await prisma.savedOpportunity.upsert({
      where: {
        userId_opportunityId: {
          userId: session.user.id,
          opportunityId: id,
        },
      },
      create: { userId: session.user.id, opportunityId: id },
      update: {},
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "hide") {
    await prisma.hiddenOpportunity.upsert({
      where: {
        userId_opportunityId: {
          userId: session.user.id,
          opportunityId: id,
        },
      },
      create: {
        userId: session.user.id,
        opportunityId: id,
        reason: body.reason || "not_interested",
      },
      update: { reason: body.reason || "not_interested" },
    });
    return NextResponse.json({ ok: true });
  }

  const token = session.accessToken || process.env.GITHUB_TOKEN || null;
  const result = await deepenOpportunityAnalysis(id, session.user.id, token);
  return NextResponse.json({
    analysis: result.analysis,
    repositoryAnalysis: result.repositoryAnalysis,
  });
}
