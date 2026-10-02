"use client";

import { useEffect, useState } from "react";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";

type FeedItem = {
  id: string;
  title: string;
  number: number;
  repo: string;
  languages: string[];
  issueType?: string | null;
  changeComplexity?: string | null;
  setupFriction?: string | null;
  updatedAt?: string | null;
  repoActivity?: string | null;
  reasons: Array<{ polarity: string; reason: string }>;
  labels?: string[];
};

export default function SearchPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [issueType, setIssueType] = useState("");
  const [complexity, setComplexity] = useState("");
  const [setup, setSetup] = useState("");
  const [gfi, setGfi] = useState<"any" | "include" | "exclude">("any");
  const [helpWanted, setHelpWanted] = useState<"any" | "include" | "exclude">(
    "any"
  );
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/opportunities");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to load opportunities");
          setLoaded(true);
          return;
        }
        setFeed(data.feed || []);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        setError("Failed to load opportunities");
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = feed.filter((item) => {
    if (language && !item.languages.some((l) => l.toLowerCase() === language.toLowerCase())) {
      return false;
    }
    if (issueType && item.issueType !== issueType) return false;
    if (complexity && item.changeComplexity !== complexity) return false;
    if (setup && item.setupFriction !== setup) return false;
    const labels = (item.labels || []).map((l) => l.toLowerCase());
    if (gfi === "include" && !labels.some((l) => l.includes("good first"))) {
      return false;
    }
    if (gfi === "exclude" && labels.some((l) => l.includes("good first"))) {
      return false;
    }
    if (
      helpWanted === "include" &&
      !labels.some((l) => l.includes("help wanted"))
    ) {
      return false;
    }
    if (
      helpWanted === "exclude" &&
      labels.some((l) => l.includes("help wanted"))
    ) {
      return false;
    }
    if (q) {
      const blob = `${item.title} ${item.repo}`.toLowerCase();
      if (!blob.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      <h1 className="text-[16px] font-medium mb-1">Search</h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        Deliberate filters over already-analyzed opportunities.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Text filter"
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px] outline-none col-span-2 md:col-span-3"
        />
        <input
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="Language"
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px] outline-none"
        />
        <select
          value={issueType}
          onChange={(e) => setIssueType(e.target.value)}
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px]"
        >
          <option value="">Issue type</option>
          {[
            "bug",
            "tests",
            "documentation",
            "ui",
            "feature",
            "accessibility",
            "performance",
            "refactor",
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={complexity}
          onChange={(e) => setComplexity(e.target.value)}
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px]"
        >
          <option value="">Change complexity</option>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <select
          value={setup}
          onChange={(e) => setSetup(e.target.value)}
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px]"
        >
          <option value="">Setup friction</option>
          <option value="low">low</option>
          <option value="moderate">moderate</option>
          <option value="high">high</option>
        </select>
        <select
          value={gfi}
          onChange={(e) => setGfi(e.target.value as typeof gfi)}
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px]"
        >
          <option value="any">good first issue: any</option>
          <option value="include">require label</option>
          <option value="exclude">exclude label</option>
        </select>
        <select
          value={helpWanted}
          onChange={(e) => setHelpWanted(e.target.value as typeof helpWanted)}
          className="bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px]"
        >
          <option value="any">help wanted: any</option>
          <option value="include">require label</option>
          <option value="exclude">exclude label</option>
        </select>
      </div>

      {!loaded ? (
        <p className="text-[12px] text-[var(--text-faint)]">Loading…</p>
      ) : error ? (
        <div className="panel p-4 text-[13px] text-[var(--negative)]">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-4 text-[13px] text-[var(--text-muted)]">
          No matches. Analyze repositories from the feed first.
        </div>
      ) : (
        filtered.map((item) => <OpportunityCard key={item.id} item={item} />)
      )}
    </div>
  );
}
