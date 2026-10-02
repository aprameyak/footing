"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PasteInput({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
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
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "" : "mb-6"}>
      <label className="block text-[12px] text-[var(--text-faint)] mb-1.5">
        Paste a GitHub repo or issue
      </label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo or github.com/owner/repo/issues/123"
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[13px] mono text-[var(--text)] outline-none focus:border-[var(--accent-dim)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-[13px] bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] disabled:opacity-40 hover:border-[var(--accent-dim)]"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[12px] text-[var(--negative)]">{error}</p>
      )}
    </form>
  );
}
