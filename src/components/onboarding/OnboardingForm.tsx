"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  INTEREST_SUGGESTIONS,
  SKILL_SUGGESTIONS,
} from "@/lib/utils/github-parse";

function TagPicker({
  label,
  hint,
  suggestions,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  suggestions: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState("");

  function toggle(name: string) {
    if (values.includes(name)) onChange(values.filter((v) => v !== name));
    else onChange([...values, name]);
  }

  function addCustom() {
    const v = custom.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setCustom("");
  }

  return (
    <section className="mb-6">
      <h2 className="text-[13px] font-medium text-[var(--text)]">{label}</h2>
      {hint && (
        <p className="text-[12px] text-[var(--text-faint)] mt-1 mb-2">{hint}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {suggestions.map((s) => {
          const active = values.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`text-[12px] px-2 py-1 border ${
                active
                  ? "border-[var(--accent-dim)] text-[var(--text)] bg-[var(--bg)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)]"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add your own"
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px] outline-none"
        />
        <button
          type="button"
          onClick={addCustom}
          className="text-[12px] px-2 border border-[var(--border)]"
        >
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 text-[12px] text-[var(--text-muted)]">
          Selected: {values.join(", ")}
        </div>
      )}
    </section>
  );
}

export function OnboardingForm({
  initial,
}: {
  initial?: {
    skills: string[];
    learningGoals: string[];
    interests: string[];
    repositories: string[];
    challengePref: string;
  };
}) {
  const router = useRouter();
  const [skills, setSkills] = useState(initial?.skills || []);
  const [learningGoals, setLearningGoals] = useState(
    initial?.learningGoals || []
  );
  const [interests, setInterests] = useState(initial?.interests || []);
  const [reposText, setReposText] = useState(
    (initial?.repositories || []).join("\n")
  );
  const [challengePref, setChallengePref] = useState(
    initial?.challengePref || "comfortable"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const repositories = reposText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills,
          learningGoals,
          interests,
          repositories,
          challengePref,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      router.push("/feed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <TagPicker
        label="What do you work with?"
        hint="Existing skills. Used for overlap with repository languages and issue topics."
        suggestions={SKILL_SUGGESTIONS}
        values={skills}
        onChange={setSkills}
      />
      <TagPicker
        label="What do you want to learn?"
        hint="Separate from skills. Opportunities can stretch into these while staying mostly familiar."
        suggestions={SKILL_SUGGESTIONS}
        values={learningGoals}
        onChange={setLearningGoals}
      />
      <TagPicker
        label="What kinds of software interest you?"
        suggestions={INTEREST_SUGGESTIONS}
        values={interests}
        onChange={setInterests}
      />

      <section className="mb-6">
        <h2 className="text-[13px] font-medium">Repositories you like</h2>
        <p className="text-[12px] text-[var(--text-faint)] mt-1 mb-2">
          One per line: owner/repo or GitHub URL
        </p>
        <textarea
          value={reposText}
          onChange={(e) => setReposText(e.target.value)}
          rows={3}
          className="w-full bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[12px] mono outline-none"
          placeholder={"vercel/next.js\nfacebook/react"}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-[13px] font-medium mb-2">Challenge preference</h2>
        <div className="flex flex-col gap-1.5">
          {[
            { id: "comfortable", label: "Comfortable — stay close to known skills" },
            {
              id: "stretch",
              label: "Stretch me slightly — mostly familiar + one new challenge",
            },
            { id: "challenge", label: "Challenge me — accept harder tasks" },
          ].map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]"
            >
              <input
                type="radio"
                name="challenge"
                checked={challengePref === opt.id}
                onChange={() => setChallengePref(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      {error && <p className="text-[12px] text-[var(--negative)] mb-3">{error}</p>}

      <button
        type="submit"
        disabled={saving || skills.length === 0}
        className="px-3 py-2 text-[13px] border border-[var(--border)] bg-[var(--bg-elevated)] disabled:opacity-40"
      >
        {saving ? "Saving…" : "Continue to feed"}
      </button>
    </form>
  );
}
