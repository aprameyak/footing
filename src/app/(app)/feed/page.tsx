import { PasteInput } from "@/components/feed/PasteInput";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { user } = await requireUser();
  const sp = await searchParams;

  const hidden = await prisma.hiddenOpportunity.findMany({
    where: { userId: user.id },
    select: { opportunityId: true },
  });
  const hiddenIds = new Set(hidden.map((h) => h.opportunityId));

  const reasons = await prisma.opportunityMatchReason.findMany({
    where: { userId: user.id },
    orderBy: [{ score: "desc" }, { weight: "desc" }],
    take: 300,
    include: {
      opportunity: {
        include: {
          repository: { include: { languages: true } },
          issue: { include: { labels: true } },
        },
      },
    },
  });

  const byOpp = new Map<
    string,
    {
      id: string;
      title: string;
      number: number;
      repo: string;
      languages: string[];
      labels: string[];
      issueType: string | null;
      changeComplexity: string | null;
      setupFriction: string | null;
      updatedAt: Date | null;
      repoActivity: Date | null;
      score: number;
      reasons: Array<{ polarity: string; reason: string }>;
    }
  >();

  for (const r of reasons) {
    if (hiddenIds.has(r.opportunityId) || r.opportunity.isFiltered) continue;
    if (sp.repo && r.opportunity.repository.fullName !== sp.repo) continue;
    const existing = byOpp.get(r.opportunityId);
    if (!existing) {
      byOpp.set(r.opportunityId, {
        id: r.opportunity.id,
        title: r.opportunity.issue.title,
        number: r.opportunity.issue.number,
        repo: r.opportunity.repository.fullName,
        languages: r.opportunity.repository.languages.map((l) => l.name),
        labels: r.opportunity.issue.labels.map((l) => l.name),
        issueType: r.opportunity.issueType,
        changeComplexity: r.opportunity.changeComplexity,
        setupFriction: r.opportunity.setupFriction,
        updatedAt: r.opportunity.issue.updatedAtGithub,
        repoActivity: r.opportunity.repository.pushedAt,
        score: r.score || 0,
        reasons: [{ polarity: r.polarity, reason: r.reason }],
      });
    } else if (existing.reasons.length < 6) {
      existing.reasons.push({ polarity: r.polarity, reason: r.reason });
    }
  }

  const feed = [...byOpp.values()].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[16px] font-medium">Feed</h1>
        <p className="text-[13px] text-[var(--text-muted)] mt-1">
          What real work could you reasonably investigate right now?
        </p>
      </div>

      <PasteInput />

      {sp.repo && (
        <div className="mb-4 text-[12px] text-[var(--text-faint)] mono">
          Showing opportunities from {sp.repo}
        </div>
      )}

      {feed.length === 0 ? (
        <div className="panel p-4 text-[13px] text-[var(--text-muted)]">
          <p className="mb-2">No ranked opportunities yet.</p>
          <p>
            Paste a public repository above — for example{" "}
            <span className="mono">facebook/react</span> or a smaller project you
            care about — with skills like React + TypeScript and a learning goal
            like testing.
          </p>
        </div>
      ) : (
        feed.map((item) => (
          <OpportunityCard
            key={item.id}
            item={{
              id: item.id,
              title: item.title,
              number: item.number,
              repo: item.repo,
              languages: item.languages,
              labels: item.labels,
              issueType: item.issueType,
              changeComplexity: item.changeComplexity,
              setupFriction: item.setupFriction,
              updatedAt: item.updatedAt,
              repoActivity: item.repoActivity,
              reasons: item.reasons,
            }}
          />
        ))
      )}
    </div>
  );
}
