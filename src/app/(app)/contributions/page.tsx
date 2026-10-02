import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatRelative } from "@/lib/utils/time";

export default async function ContributionsPage() {
  const { user } = await requireUser();
  const contributions = await prisma.contribution.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      opportunity: {
        include: {
          repository: true,
          issue: true,
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-[16px] font-medium mb-1">Contributions</h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        Active and past attempts. Abandonment is data, not failure.
      </p>

      {contributions.length === 0 ? (
        <div className="panel p-4 text-[13px] text-[var(--text-muted)]">
          No contributions started yet. Investigate an opportunity from the feed.
        </div>
      ) : (
        <ul className="space-y-2">
          {contributions.map((c) => (
            <li key={c.id} className="panel px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">
                    {c.opportunity.issue.title}
                  </div>
                  <div className="mono text-[12px] text-[var(--text-faint)] mt-0.5">
                    {c.opportunity.repository.fullName} #
                    {c.opportunity.issue.number}
                  </div>
                  <div className="text-[11px] text-[var(--text-faint)] mt-1">
                    {c.status} · stage {c.currentStage} · updated{" "}
                    {formatRelative(c.updatedAt)}
                    {c.abandonReason ? ` · stopped: ${c.abandonReason}` : ""}
                  </div>
                </div>
                {c.status !== "abandoned" && (
                  <Link
                    href={`/workspace/${c.id}`}
                    className="text-[12px] no-underline border border-[var(--border)] px-2 py-1"
                  >
                    Open workspace
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
