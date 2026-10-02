import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";

export default async function SavedPage() {
  const { user } = await requireUser();
  const saved = await prisma.savedOpportunity.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      opportunity: {
        include: {
          repository: { include: { languages: true } },
          issue: true,
          matchReasons: { where: { userId: user.id } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-[16px] font-medium mb-1">Saved</h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        Opportunities you marked for later.
      </p>
      {saved.length === 0 ? (
        <div className="panel p-4 text-[13px] text-[var(--text-muted)]">
          Nothing saved yet.{" "}
          <Link href="/feed" className="no-underline">
            Browse feed
          </Link>
        </div>
      ) : (
        saved.map((s) => (
          <OpportunityCard
            key={s.id}
            item={{
              id: s.opportunity.id,
              title: s.opportunity.issue.title,
              number: s.opportunity.issue.number,
              repo: s.opportunity.repository.fullName,
              languages: s.opportunity.repository.languages.map((l) => l.name),
              issueType: s.opportunity.issueType,
              changeComplexity: s.opportunity.changeComplexity,
              setupFriction: s.opportunity.setupFriction,
              updatedAt: s.opportunity.issue.updatedAtGithub,
              repoActivity: s.opportunity.repository.pushedAt,
              reasons: s.opportunity.matchReasons.map((r) => ({
                polarity: r.polarity,
                reason: r.reason,
              })),
            }}
          />
        ))
      )}
    </div>
  );
}
