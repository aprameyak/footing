"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STUCK_CATEGORIES, ABANDON_REASONS } from "@/lib/utils/github-parse";

type ChecklistItem = {
  id: string;
  stage: string;
  label: string;
  checked: boolean;
  provenancePath: string | null;
  provenanceKind: string | null;
  inferred: boolean;
};

type ContributionPayload = {
  id: string;
  status: string;
  currentStage: string;
  checklistItems: ChecklistItem[];
  blockers: Array<{
    id: string;
    category: string;
    detail: string | null;
    guidance: string | null;
    createdAt: string;
  }>;
  pullRequests: Array<{
    number: number;
    htmlUrl: string;
    state: string;
    merged: boolean;
  }>;
  opportunity: {
    repository: {
      fullName: string;
      htmlUrl: string;
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
    };
    issue: {
      title: string;
      number: number;
      htmlUrl: string;
      analysis: {
        summary: string | null;
        maintainerRequested: string | null;
        inferredRequirements: string | null;
        knowledgeKnown: string[];
        knowledgeEncounter: string[];
        difficultyWhy: string | null;
        relevantPaths: Array<{ path: string; reason: string }> | null;
      } | null;
    };
  };
};

const STAGES = [
  "understand",
  "setup",
  "reproduce",
  "investigate",
  "implement",
  "verify",
  "submit",
];

export function Workspace({ data }: { data: ContributionPayload }) {
  const router = useRouter();
  const [stage, setStage] = useState(data.currentStage);
  const [items, setItems] = useState(data.checklistItems);
  const [blockers, setBlockers] = useState(data.blockers);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [stuckCategory, setStuckCategory] = useState<string>(STUCK_CATEGORIES[0].id);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function setStageRemote(next: string, complete?: boolean) {
    setStage(next);
    await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_stage",
        contributionId: data.id,
        stage: next,
        complete,
      }),
    });
  }

  async function toggleItem(item: ChecklistItem) {
    const checked = !item.checked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked } : i))
    );
    await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_checklist",
        itemId: item.id,
        checked,
      }),
    });
  }

  async function submitStuck() {
    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "stuck",
        contributionId: data.id,
        category: stuckCategory,
      }),
    });
    const json = await res.json();
    if (json.blocker) setBlockers((b) => [json.blocker, ...b]);
    setStuckOpen(false);
  }

  async function detectPr() {
    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "detect_pr",
        contributionId: data.id,
      }),
    });
    const json = await res.json();
    setMessage(
      json.found
        ? `Detected ${json.found} related PR(s).`
        : "No matching PR detected yet."
    );
    router.refresh();
  }

  async function abandon(reason: string) {
    await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "abandon",
        contributionId: data.id,
        reason,
      }),
    });
    router.push("/contributions");
    router.refresh();
  }

  const analysis = data.opportunity.issue.analysis;
  const readiness = data.opportunity.repository.analysis;
  const stageItems = items.filter((i) => i.stage === stage);

  return (
    <div className="max-w-3xl">
      <div className="text-[12px] text-[var(--text-faint)] mono mb-1">
        {data.opportunity.repository.fullName} #
        {data.opportunity.issue.number}
      </div>
      <h1 className="text-[18px] font-medium leading-snug">
        {data.opportunity.issue.title}
      </h1>
      <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
        <a
          href={data.opportunity.issue.htmlUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open issue on GitHub
        </a>
        <span className="text-[var(--text-faint)]">Status: {data.status}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-1">
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStageRemote(s)}
            className={`text-[11px] px-2 py-1 border capitalize ${
              stage === s
                ? "border-[var(--accent-dim)] text-[var(--text)]"
                : "border-[var(--border-subtle)] text-[var(--text-faint)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <section className="mt-6 panel p-4">
        {stage === "understand" && (
          <div className="space-y-3 text-[13px] text-[var(--text-muted)]">
            <div>
              <div className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
                Issue objective
              </div>
              <p>{analysis?.summary || "Analysis not available yet."}</p>
            </div>
            {analysis?.maintainerRequested && (
              <div>
                <div className="text-[11px] uppercase text-[var(--positive)] mb-1">
                  Maintainer explicitly requested
                </div>
                <p>{analysis.maintainerRequested}</p>
              </div>
            )}
            {analysis?.inferredRequirements && (
              <div>
                <div className="text-[11px] uppercase text-[var(--warn)] mb-1">
                  System inference (not maintainer requirements)
                </div>
                <p>{analysis.inferredRequirements}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <div className="text-[var(--text-faint)] mb-1">You already know</div>
                {(analysis?.knowledgeKnown || []).join(", ") || "—"}
              </div>
              <div>
                <div className="text-[var(--text-faint)] mb-1">You may encounter</div>
                {(analysis?.knowledgeEncounter || []).join(", ") || "—"}
              </div>
            </div>
          </div>
        )}

        {(stage === "setup" || stage === "reproduce" || stage === "verify" || stage === "submit") && (
          <div>
            <div className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
              {stage} checklist
            </div>
            {stageItems.length === 0 ? (
              <p className="text-[12px] text-[var(--text-faint)]">
                {stage === "setup"
                  ? "Setup documentation appears incomplete."
                  : "No items extracted for this stage."}
              </p>
            ) : (
              <ul className="space-y-2">
                {stageItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item)}
                      className="mt-1"
                    />
                    <div>
                      <div className="mono text-[12px] text-[var(--text)]">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)]">
                        {item.inferred ? "Inferred / suggested" : "From docs"}
                        {item.provenancePath ? ` · View source: ${item.provenancePath}` : ""}
                        {item.provenanceKind ? ` · ${item.provenanceKind}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setStageRemote(stage, true)}
              className="mt-4 text-[12px] px-2 py-1 border border-[var(--border)]"
            >
              Mark {stage} complete
            </button>
          </div>
        )}

        {stage === "investigate" && (
          <div>
            <div className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
              Likely starting areas
            </div>
            <p className="text-[11px] text-[var(--warn)] mb-3">
              Suggested starting points — not repository instructions.
            </p>
            {(analysis?.relevantPaths || []).length === 0 ? (
              <p className="text-[12px] text-[var(--text-faint)]">
                No high-confidence paths found. Search the repo for distinctive
                terms from the issue title.
              </p>
            ) : (
              <ul className="space-y-3">
                {(analysis?.relevantPaths || []).map((p, i) => (
                  <li key={i}>
                    <div className="mono text-[12px] text-[var(--text)]">{p.path}</div>
                    <div className="text-[12px] text-[var(--text-muted)]">
                      Reason: {p.reason}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {analysis?.difficultyWhy && (
              <p className="mt-4 text-[12px] text-[var(--text-muted)]">
                {analysis.difficultyWhy}
              </p>
            )}
          </div>
        )}

        {stage === "implement" && (
          <div className="text-[13px] text-[var(--text-muted)] space-y-2">
            <p>
              Implement the change yourself. Use the starting areas above, keep
              the diff scoped to the issue, and prefer matching existing patterns
              in the repository.
            </p>
            <p className="text-[12px] text-[var(--text-faint)]">
              footing will not generate a full patch. That is intentional.
            </p>
            <button
              type="button"
              onClick={() => setStageRemote("implement", true)}
              className="text-[12px] px-2 py-1 border border-[var(--border)]"
            >
              Mark implementation in progress / done
            </button>
          </div>
        )}
      </section>

      {readiness && (
        <section className="mt-4 panel p-4">
          <div className="text-[11px] uppercase text-[var(--text-faint)] mb-2">
            Contributor readiness
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[12px] mono text-[var(--text-muted)]">
            <div>CONTRIBUTING.md {readiness.contributingFound ? "Found" : "Missing"}</div>
            <div>Development setup {readiness.setupDocumented ? "Documented" : "Unclear"}</div>
            <div>Test instructions {readiness.testInstructionsFound ? "Found" : "Missing"}</div>
            <div>Issue templates {readiness.issueTemplatesFound ? "Found" : "Missing"}</div>
            <div>Recent repository activity {readiness.recentActivity ? "Yes" : "No"}</div>
            <div>Recent external PRs {readiness.recentExternalPrs ? "Yes" : "No"}</div>
            <div>Maintainer responses {readiness.maintainerResponses || "—"}</div>
            <div>CLA/DCO {readiness.claRequired}</div>
            <div>AI contribution policy {readiness.aiPolicy}</div>
            <div>Setup friction {readiness.setupFriction}</div>
          </div>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStuckOpen((v) => !v)}
          className="text-[12px] px-2.5 py-1.5 border border-[var(--border)]"
        >
          I&apos;m stuck
        </button>
        <button
          type="button"
          onClick={detectPr}
          className="text-[12px] px-2.5 py-1.5 border border-[var(--border)]"
        >
          Detect PR
        </button>
        <button
          type="button"
          onClick={() => setAbandonOpen((v) => !v)}
          className="text-[12px] px-2.5 py-1.5 border border-[var(--border-subtle)] text-[var(--text-faint)]"
        >
          Abandon
        </button>
      </div>

      {message && (
        <p className="mt-2 text-[12px] text-[var(--text-muted)]">{message}</p>
      )}

      {stuckOpen && (
        <div className="mt-3 panel p-3">
          <div className="text-[12px] mb-2">What&apos;s blocking you?</div>
          <select
            value={stuckCategory}
            onChange={(e) => setStuckCategory(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] text-[12px] px-2 py-1.5 mb-2"
          >
            {STUCK_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitStuck}
            className="text-[12px] px-2 py-1 border border-[var(--border)]"
          >
            Get guidance
          </button>
        </div>
      )}

      {abandonOpen && (
        <div className="mt-3 panel p-3">
          <div className="text-[12px] mb-2">What stopped you? (optional)</div>
          <div className="flex flex-col gap-1">
            {ABANDON_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => abandon(r.id)}
                className="text-left text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {blockers.length > 0 && (
        <section className="mt-4 space-y-3">
          {blockers.map((b) => (
            <div key={b.id} className="panel p-3">
              <div className="text-[11px] text-[var(--text-faint)] mb-1">
                Mentor note · {b.category}
              </div>
              <pre className="whitespace-pre-wrap text-[12px] text-[var(--text-muted)] font-[family-name:var(--font-sans)]">
                {b.guidance}
              </pre>
            </div>
          ))}
        </section>
      )}

      {data.pullRequests.length > 0 && (
        <section className="mt-4 text-[12px]">
          <div className="text-[11px] uppercase text-[var(--text-faint)] mb-1">
            Detected pull requests
          </div>
          {data.pullRequests.map((pr) => (
            <div key={pr.number}>
              <a href={pr.htmlUrl} target="_blank" rel="noreferrer">
                #{pr.number}
              </a>{" "}
              <span className="text-[var(--text-faint)]">
                {pr.state}
                {pr.merged ? " · merged" : ""}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
