"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STARTERS = [
  "withastro/astro",
  "remix-run/remix",
  "t3-oss/create-t3-app",
  "vercel/next.js",
];

export function StarterRepos() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(repo: string) {
    setBusy(repo);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.focusOpportunityId) {
        router.push(`/investigate/${data.focusOpportunityId}`);
      } else {
        router.push(`/feed?repo=${encodeURIComponent(data.fullName)}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel p-4 text-[13px] text-[var(--text-muted)]">
      <p className="mb-2">No ranked opportunities yet.</p>
      <p className="mb-3">Paste a public repository above, or analyze a starter:</p>
      <ul className="flex flex-wrap gap-2">
        {STARTERS.map((repo) => (
          <li key={repo}>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void analyze(repo)}
              className="mono text-[12px] px-2 py-1 border border-[var(--border)] disabled:opacity-40 hover:border-[var(--accent-dim)]"
            >
              {busy === repo ? "…" : repo}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-[12px] text-[var(--negative)]">{error}</p>
      )}
      <p className="mt-3 text-[12px] text-[var(--text-faint)]">
        Works best with matching skills (e.g. React + TypeScript) and a learning
        goal like testing.
      </p>
    </div>
  );
}
