import Link from "next/link";
import { formatRelative } from "@/lib/utils/cn";

export type OpportunityCardData = {
  id: string;
  title: string;
  number: number;
  repo: string;
  languages: string[];
  issueType?: string | null;
  changeComplexity?: string | null;
  setupFriction?: string | null;
  updatedAt?: Date | string | null;
  repoActivity?: Date | string | null;
  reasons: Array<{ polarity: string; reason: string }>;
  labels?: string[];
};

export function OpportunityCard({ item }: { item: OpportunityCardData }) {
  return (
    <article className="panel px-4 py-3 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium text-[var(--text)] leading-snug">
            {item.title}
          </h2>
          <div className="mt-1 mono text-[12px] text-[var(--text-faint)]">
            {item.repo} #{item.number}
          </div>
        </div>
        <Link
          href={`/investigate/${item.id}`}
          className="shrink-0 text-[12px] px-2.5 py-1 border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] no-underline"
        >
          Investigate
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--text-muted)]">
        {item.languages.slice(0, 4).map((l) => (
          <span key={l} className="mono">
            {l}
          </span>
        ))}
        {(item.labels || []).slice(0, 4).map((l) => (
          <span key={l} className="text-[var(--text-faint)]">
            {l}
          </span>
        ))}
        {item.issueType && (
          <span className="text-[var(--text-faint)]">{item.issueType}</span>
        )}
      </div>

      {item.reasons.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] mb-1">
            Why this appeared
          </div>
          <ul className="space-y-0.5">
            {item.reasons.slice(0, 5).map((r, i) => (
              <li key={i} className="text-[12px] text-[var(--text-muted)]">
                <span
                  className={
                    r.polarity === "+"
                      ? "text-[var(--positive)] mono"
                      : "text-[var(--negative)] mono"
                  }
                >
                  {r.polarity}
                </span>{" "}
                {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-faint)]">
        <span>Change complexity: {item.changeComplexity || "—"}</span>
        <span>Setup friction: {item.setupFriction || "—"}</span>
        <span>Issue activity: {formatRelative(item.updatedAt)}</span>
        <span>Repo activity: {formatRelative(item.repoActivity)}</span>
      </div>
    </article>
  );
}
