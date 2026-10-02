"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatRelative } from "@/lib/utils/time";

type Detail = {
  id: string;
  repository: {
    fullName: string;
    htmlUrl: string;
    languages: Array<{ name: string }>;
    topics: Array<{ name: string }>;
    analysis: {
      contributingFound: boolean;
      setupDocumented: boolean;
      testInstructionsFound: boolean;
      issueTemplatesFound: boolean;
      recentActivity: boolean;
      recentExternalPrs: boolean;
      maintainerResponses: string | null;
      claRequired: string;
      aiPolicy: string;
      setupFriction: string;
    } | null;
    pushedAt: string | null;
  };
  issue: {
    title: string;
    number: number;
    htmlUrl: string;
    body: string | null;
    assigneeLogins: string[];
    updatedAtGithub: string | null;
    labels: Array<{ name: string }>;
    linkedPrs: Array<{ number: number; state: string; merged: boolean; htmlUrl: string }>;
    analysis: {
      summary: string | null;
      maintainerRequested: string | null;
      inferredRequirements: string | null;
      knowledgeKnown: string[];
      knowledgeEncounter: string[];
      codeChange: string | null;
      codebaseContext: string | null;
      conceptComplexity: string | null;
      setupFriction: string | null;
      difficultyWhy: string | null;
      viabilitySignals: Array<{ label: string; ok: boolean; note?: string }> | null;
      relevantPaths: Array<{ path: string; reason: string }> | null;
    } | null;
  };
  matchReasons: Array<{ polarity: string; reason: string }>;
  changeComplexity: string | null;
  setupFriction: string | null;
  issueType: string | null;
};

export default function InvestigatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/opportunities/${id}`);
      if (!res.ok) {
        setError("Opportunity not found");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
      if (!json.issue.analysis) {
        setAnalyzing(true);
        const a = await fetch(`/api/opportunities/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (a.ok) {
          const refreshed = await fetch(`/api/opportunities/${id}`);
          setData(await refreshed.json());
        }
        setAnalyzing(false);
      }
    })();
  }, [id]);

  async function startContribution() {
    if (!id) return;
    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", opportunityId: id }),
    });
    const json = await res.json();
    if (json.id) router.push(`/workspace/${json.id}`);
  }

  async function save() {
    if (!id) return;
    await fetch(`/api/opportunities/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save" }),
    });
  }

  async function hide() {
    if (!id) return;
    await fetch(`/api/opportunities/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hide", reason: "not_interested" }),
    });
    router.push("/feed");
  }

  if (loading || !data) {
    return (
      <div className="text-[13px] text-[var(--text-muted)]">
        {error || (analyzing ? "Analyzing issue…" : "Loading…")}
      </div>
    );
  }

  const a = data.issue.analysis;
  const readiness = data.repository.analysis;

  return (
    <div className="max-w-3xl">
      <div className="text-[12px] mono text-[var(--text-faint)]">
        {data.repository.fullName} #{data.issue.number}
      </div>
      <h1 className="text-[18px] font-medium mt-1 leading-snug">
        {data.issue.title}
      </h1>
      <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
        <a href={data.issue.htmlUrl} target="_blank" rel="noreferrer">
          GitHub issue
        </a>
        <span className="text-[var(--text-faint)]">
          Updated {formatRelative(data.issue.updatedAtGithub)}
        </span>
        {data.issueType && (
          <span className="text-[var(--text-muted)]">{data.issueType}</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startContribution}
          className="text-[13px] px-3 py-1.5 border border-[var(--accent-dim)] text-[var(--text)]"
        >
          Start contribution
        </button>
        <button
          type="button"
          onClick={save}
          className="text-[12px] px-2.5 py-1.5 border border-[var(--border)]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={hide}
          className="text-[12px] px-2.5 py-1.5 border border-[var(--border-subtle)] text-[var(--text-faint)]"
        >
          Not interested
        </button>
        <Link
          href="/feed"
          className="text-[12px] px-2.5 py-1.5 text-[var(--text-faint)] no-underline"
        >
          Back to feed
        </Link>
      </div>

      {analyzing && (
        <p className="mt-3 text-[12px] text-[var(--text-faint)]">
          Refreshing issue analysis from GitHub…
        </p>
      )}

      <section className="mt-6 panel p-4 space-y-4">
        <div>
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
            1. What is this actually asking for?
          </h2>
          <p className="text-[13px] text-[var(--text-muted)]">
            {a?.summary || "Not analyzed yet."}
          </p>
          {a?.maintainerRequested && (
            <div className="mt-2">
              <div className="text-[11px] text-[var(--positive)]">
                Maintainer explicitly requested
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                {a.maintainerRequested}
              </p>
            </div>
          )}
          {a?.inferredRequirements && (
            <div className="mt-2">
              <div className="text-[11px] text-[var(--warn)]">
                System inference
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                {a.inferredRequirements}
              </p>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
            2. What knowledge does it require?
          </h2>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <div className="text-[var(--text-faint)]">You already know</div>
              <div className="text-[var(--text-muted)]">
                {(a?.knowledgeKnown || []).join(", ") || "—"}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-faint)]">You may encounter</div>
              <div className="text-[var(--text-muted)]">
                {(a?.knowledgeEncounter || []).join(", ") || "—"}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
            3. How difficult is the contribution?
          </h2>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-[var(--text-muted)]">
            <div>Code change: {a?.codeChange || data.changeComplexity || "—"}</div>
            <div>Codebase context: {a?.codebaseContext || "—"}</div>
            <div>Concept complexity: {a?.conceptComplexity || "—"}</div>
            <div>
              Environment/setup friction:{" "}
              {a?.setupFriction || data.setupFriction || "—"}
            </div>
          </div>
          {a?.difficultyWhy && (
            <p className="mt-2 text-[12px] text-[var(--text-faint)]">
              {a.difficultyWhy}
            </p>
          )}
        </div>

        <div>
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
            4. Is the opportunity still viable?
          </h2>
          <ul className="space-y-1">
            {(a?.viabilitySignals || []).map((s, i) => (
              <li key={i} className="text-[12px] text-[var(--text-muted)]">
                <span
                  className={
                    s.ok ? "text-[var(--positive)]" : "text-[var(--negative)]"
                  }
                >
                  {s.ok ? "●" : "○"}
                </span>{" "}
                {s.label}
                {s.note ? (
                  <span className="text-[var(--text-faint)]"> — {s.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {readiness && (
        <section className="mt-4 panel p-4">
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
            Contributor readiness
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[12px] mono text-[var(--text-muted)]">
            <div>CONTRIBUTING.md {readiness.contributingFound ? "Found" : "Missing"}</div>
            <div>Development setup {readiness.setupDocumented ? "Documented" : "Unclear"}</div>
            <div>Test instructions {readiness.testInstructionsFound ? "Found" : "Missing"}</div>
            <div>Issue templates {readiness.issueTemplatesFound ? "Found" : "Missing"}</div>
            <div>Recent repository activity {readiness.recentActivity ? "Yes" : "No"}</div>
            <div>Recent external PRs {readiness.recentExternalPrs ? "Yes" : "No"}</div>
            <div>CLA/DCO {readiness.claRequired}</div>
            <div>AI policy {readiness.aiPolicy}</div>
            <div>Setup friction {readiness.setupFriction}</div>
          </div>
        </section>
      )}

      {(a?.relevantPaths || []).length > 0 && (
        <section className="mt-4 panel p-4">
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
            Suggested starting points
          </h2>
          <p className="text-[11px] text-[var(--warn)] mb-2">
            Inferred from issue text and repository paths — not maintainer instructions.
          </p>
          <ul className="space-y-2">
            {(a?.relevantPaths || []).map((p, i) => (
              <li key={i}>
                <div className="mono text-[12px]">{p.path}</div>
                <div className="text-[12px] text-[var(--text-faint)]">{p.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.matchReasons.length > 0 && (
        <section className="mt-4 panel p-4">
          <h2 className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
            Match reasons
          </h2>
          <ul className="space-y-0.5">
            {data.matchReasons.map((r, i) => (
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
        </section>
      )}
    </div>
  );
}
