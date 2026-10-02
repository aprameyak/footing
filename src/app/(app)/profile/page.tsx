import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export default async function ProfilePage() {
  const { user } = await requireUser();

  const evidence = await prisma.skillEvidence.findMany({
    where: { userId: user.id },
    orderBy: { count: "desc" },
  });

  const outcomes = await prisma.contributionOutcome.groupBy({
    by: ["event"],
    where: { contribution: { userId: user.id } },
    _count: { event: true },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-[16px] font-medium mb-1">Profile</h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        Evidence from contributions, not proficiency claims.
      </p>

      <section className="panel p-4 mb-4">
        <div className="mono text-[13px]">@{user.login}</div>
        <div className="text-[12px] text-[var(--text-faint)] mt-1">
          Challenge preference: {user.challengePref}
        </div>
        <Link
          href="/onboarding"
          className="inline-block mt-3 text-[12px] no-underline border border-[var(--border)] px-2 py-1"
        >
          Edit skills & interests
        </Link>
      </section>

      <section className="panel p-4 mb-4">
        <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
          Skills
        </h2>
        <div className="text-[13px] text-[var(--text-muted)]">
          {user.skills.map((s) => s.name).join(", ") || "—"}
        </div>
        <h2 className="text-[11px] uppercase text-[var(--text-faint)] mt-4 mb-2">
          Learning goals
        </h2>
        <div className="text-[13px] text-[var(--text-muted)]">
          {user.learningGoals.map((s) => s.name).join(", ") || "—"}
        </div>
        <h2 className="text-[11px] uppercase text-[var(--text-faint)] mt-4 mb-2">
          Interests
        </h2>
        <div className="text-[13px] text-[var(--text-muted)]">
          {user.interests.map((s) => s.name).join(", ") || "—"}
        </div>
      </section>

      <section className="panel p-4 mb-4">
        <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
          Contribution experience
        </h2>
        {evidence.length === 0 ? (
          <p className="text-[12px] text-[var(--text-faint)]">
            No contribution evidence yet. Merged PRs update this list.
          </p>
        ) : (
          <ul className="space-y-1 text-[13px] text-[var(--text-muted)]">
            {evidence.map((e) => (
              <li key={e.id}>
                <span className="text-[var(--text)]">{e.skill}</span>
                <span className="text-[var(--text-faint)]">
                  {" "}
                  · used in {e.count} contribution
                  {e.count === 1 ? "" : "s"} ({e.source})
                </span>
              </li>
            ))}
          </ul>
        )}
        {user.learningGoals.map((g) => {
          const hit = evidence.find(
            (e) => e.skill.toLowerCase() === g.name.toLowerCase()
          );
          if (hit) return null;
          return (
            <div
              key={g.id}
              className="text-[12px] text-[var(--text-faint)] mt-1"
            >
              {g.name} · used in 0 contributions · learning goal
            </div>
          );
        })}
      </section>

      <section className="panel p-4">
        <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
          Outcome signals
        </h2>
        {outcomes.length === 0 ? (
          <p className="text-[12px] text-[var(--text-faint)]">No events yet.</p>
        ) : (
          <ul className="text-[12px] mono text-[var(--text-muted)] space-y-0.5">
            {outcomes.map((o) => (
              <li key={o.event}>
                {o.event}: {o._count.event}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
