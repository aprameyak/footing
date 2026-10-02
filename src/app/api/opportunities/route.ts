import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hidden = await prisma.hiddenOpportunity.findMany({
    where: { userId: session.user.id },
    select: { opportunityId: true },
  });
  const hiddenIds = new Set(hidden.map((h) => h.opportunityId));

  const reasons = await prisma.opportunityMatchReason.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      opportunity: {
        include: {
          repository: { include: { languages: true, topics: true } },
          issue: { include: { labels: true } },
        },
      },
    },
  });

  const byOpp = new Map<
    string,
    {
      opportunity: (typeof reasons)[0]["opportunity"];
      score: number;
      reasons: Array<{ polarity: string; reason: string; weight: number }>;
    }
  >();

  for (const r of reasons) {
    if (hiddenIds.has(r.opportunityId) || r.opportunity.isFiltered) continue;
    const existing = byOpp.get(r.opportunityId);
    if (!existing) {
      byOpp.set(r.opportunityId, {
        opportunity: r.opportunity,
        score: r.score || 0,
        reasons: [
          { polarity: r.polarity, reason: r.reason, weight: r.weight },
        ],
      });
    } else {
      existing.reasons.push({
        polarity: r.polarity,
        reason: r.reason,
        weight: r.weight,
      });
    }
  }

  const feed = [...byOpp.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map((item) => ({
      id: item.opportunity.id,
      score: item.score,
      reasons: item.reasons
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8),
      title: item.opportunity.issue.title,
      number: item.opportunity.issue.number,
      htmlUrl: item.opportunity.issue.htmlUrl,
      repo: item.opportunity.repository.fullName,
      languages: item.opportunity.repository.languages.map((l) => l.name).slice(0, 4),
      topics: item.opportunity.repository.topics.map((t) => t.name).slice(0, 4),
      labels: item.opportunity.issue.labels.map((l) => l.name),
      issueType: item.opportunity.issueType,
      changeComplexity: item.opportunity.changeComplexity,
      setupFriction: item.opportunity.setupFriction,
      updatedAt: item.opportunity.issue.updatedAtGithub,
      repoActivity: item.opportunity.repository.pushedAt,
    }));

  return NextResponse.json({ feed });
}
