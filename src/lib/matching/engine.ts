export type MatchReason = {
  polarity: "+" | "-";
  reason: string;
  weight: number;
};

export type UserMatchProfile = {
  skills: string[];
  learningGoals: string[];
  interests: string[];
  likedRepos: string[];
  challengePref: "comfortable" | "stretch" | "challenge";
  experiencedSkills?: string[];
};

export type OpportunitySignals = {
  title: string;
  body: string | null;
  labels: string[];
  languages: string[];
  topics: string[];
  repoFullName: string;
  updatedAt: Date | null;
  repoPushedAt: Date | null;
  hasAssignee: boolean;
  hasLinkedActivePr: boolean;
  commentsCount: number;
  isArchived: boolean;
  hasContributing: boolean;
  setupFriction: "low" | "moderate" | "high";
  issueType: string;
  changeComplexity: "low" | "medium" | "high";
  codebaseContext: "low" | "medium" | "high";
};

function norm(s: string) {
  return s.toLowerCase().trim();
}

function overlaps(a: string[], b: string[]): string[] {
  const bset = new Set(b.map(norm));
  return a.filter((x) => bset.has(norm(x)));
}

const TECH_ALIASES: Record<string, string[]> = {
  typescript: ["ts", "tsx"],
  javascript: ["js", "jsx", "node"],
  "next.js": ["nextjs", "next"],
  react: ["reactjs", "react.js"],
  postgresql: ["postgres", "psql", "pg"],
  "node.js": ["nodejs", "node"],
};

function expandTerms(terms: string[]): string[] {
  const out = new Set(terms.map(norm));
  for (const t of terms) {
    const n = norm(t);
    out.add(n);
    for (const [k, aliases] of Object.entries(TECH_ALIASES)) {
      if (k === n || aliases.includes(n)) {
        out.add(k);
        aliases.forEach((a) => out.add(a));
      }
    }
  }
  return [...out];
}

function textBlob(signals: OpportunitySignals): string {
  return [
    signals.title,
    signals.body || "",
    ...signals.labels,
    ...signals.languages,
    ...signals.topics,
  ]
    .join(" ")
    .toLowerCase();
}

export function classifyIssueType(labels: string[], title: string, body: string | null): string {
  const blob = [...labels, title, body || ""].join(" ").toLowerCase();
  if (/accessib|a11y/.test(blob)) return "accessibility";
  if (/test|spec|coverage|jest|playwright|cypress|vitest/.test(blob)) return "tests";
  if (/doc|readme|typo|documentation/.test(blob)) return "documentation";
  if (/perf|performance|slow|optim/.test(blob)) return "performance";
  if (/refactor/.test(blob)) return "refactor";
  if (/ui|css|style|layout|design|frontend/.test(blob)) return "ui";
  if (/bug|fix|error|crash|broken|overflow/.test(blob)) return "bug";
  if (/feature|enhancement|add support/.test(blob)) return "feature";
  if (/help wanted|good first issue/.test(blob)) return "help-wanted";
  return "other";
}

export function estimateChangeComplexity(
  title: string,
  body: string | null,
  labels: string[]
): "low" | "medium" | "high" {
  const blob = [...labels, title, body || ""].join(" ").toLowerCase();
  if (/architect|rewrite|migrat|breaking|security|protocol|consensus/.test(blob)) {
    return "high";
  }
  if (
    /typo|docs|readme|label|changelog|spell|wording|copy|css|style|test only|unit test/.test(
      blob
    )
  ) {
    return "low";
  }
  if (/good first issue|beginner|easy|starter/.test(blob)) return "low";
  if ((body || "").length > 2500) return "medium";
  return "medium";
}

export function estimateCodebaseContext(
  body: string | null,
  labels: string[]
): "low" | "medium" | "high" {
  const blob = [body || "", ...labels].join(" ").toLowerCase();
  if (/across modules|entire|architecture|multiple packages|monorepo-wide/.test(blob)) {
    return "high";
  }
  if (/specific file|component|localized|one place|small change/.test(blob)) {
    return "low";
  }
  if (/good first issue|documentation|typo/.test(blob)) return "low";
  return "medium";
}

export function scoreOpportunity(
  profile: UserMatchProfile,
  signals: OpportunitySignals
): { score: number; reasons: MatchReason[]; filtered: boolean; filterReason?: string } {
  const reasons: MatchReason[] = [];
  let score = 0;

  if (signals.isArchived) {
    return {
      score: -100,
      reasons: [{ polarity: "-", reason: "Repository is archived", weight: 10 }],
      filtered: true,
      filterReason: "archived",
    };
  }

  if (signals.hasLinkedActivePr) {
    reasons.push({
      polarity: "-",
      reason: "Active linked PR detected",
      weight: 8,
    });
    score -= 40;
  }

  if (signals.hasAssignee) {
    reasons.push({
      polarity: "-",
      reason: "Issue has an assignee",
      weight: 6,
    });
    score -= 25;
  }

  const daysSinceIssue = signals.updatedAt
    ? (Date.now() - signals.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  if (daysSinceIssue > 180) {
    reasons.push({
      polarity: "-",
      reason: "Issue appears stale (no updates in ~6 months)",
      weight: 7,
    });
    score -= 35;
  } else if (daysSinceIssue <= 14) {
    reasons.push({
      polarity: "+",
      reason: "Issue updated recently",
      weight: 4,
    });
    score += 12;
  }

  const daysSincePush = signals.repoPushedAt
    ? (Date.now() - signals.repoPushedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  if (daysSincePush > 365) {
    reasons.push({
      polarity: "-",
      reason: "Repository appears abandoned",
      weight: 9,
    });
    score -= 50;
  } else if (daysSincePush <= 30) {
    reasons.push({
      polarity: "+",
      reason: "Repository recently active",
      weight: 4,
    });
    score += 10;
  }

  const body = signals.body || "";
  if (body.trim().length < 40 && !/good first issue|help wanted/.test(signals.labels.join(" ").toLowerCase())) {
    reasons.push({
      polarity: "-",
      reason: "Issue description is vague / thin",
      weight: 5,
    });
    score -= 15;
  }

  if (!signals.hasContributing) {
    reasons.push({
      polarity: "-",
      reason: "Contribution instructions not detected",
      weight: 2,
    });
    score -= 4;
  } else {
    reasons.push({
      polarity: "+",
      reason: "Contribution documentation found",
      weight: 3,
    });
    score += 6;
  }

  const skillHits = overlaps(
    expandTerms(profile.skills),
    expandTerms([...signals.languages, ...signals.labels, ...signals.topics])
  );
  const blob = textBlob(signals);
  for (const skill of profile.skills) {
    const terms = expandTerms([skill]);
    if (terms.some((t) => blob.includes(t) || skillHits.map(norm).includes(t))) {
      reasons.push({
        polarity: "+",
        reason: `${skill} matches existing skill`,
        weight: 5,
      });
      score += 14;
    }
  }

  for (const goal of profile.learningGoals) {
    const terms = expandTerms([goal]);
    if (terms.some((t) => blob.includes(t))) {
      reasons.push({
        polarity: "+",
        reason: `${goal} matches learning goal`,
        weight: 6,
      });
      score += 16;
    }
  }

  for (const interest of profile.interests) {
    const terms = expandTerms([interest]);
    const topicHits = signals.topics.some((t) =>
      terms.some((term) => norm(t).includes(term) || term.includes(norm(t)))
    );
    if (topicHits || terms.some((t) => blob.includes(t))) {
      reasons.push({
        polarity: "+",
        reason: `Repository topic matches ${interest} interest`,
        weight: 3,
      });
      score += 8;
    }
  }

  for (const liked of profile.likedRepos) {
    if (norm(liked) === norm(signals.repoFullName)) {
      reasons.push({
        polarity: "+",
        reason: "You marked interest in this repository",
        weight: 5,
      });
      score += 15;
    }
  }

  if (signals.setupFriction === "high") {
    reasons.push({
      polarity: "-",
      reason: "Repository setup friction appears high",
      weight: 3,
    });
    score -= 8;
  } else if (signals.setupFriction === "low") {
    reasons.push({
      polarity: "+",
      reason: "Setup friction appears low",
      weight: 2,
    });
    score += 5;
  }

  const experienced = new Set((profile.experiencedSkills || []).map(norm));
  const isDocOnly =
    signals.issueType === "documentation" && signals.changeComplexity === "low";
  if (experienced.size >= 2 && isDocOnly && profile.challengePref !== "comfortable") {
    reasons.push({
      polarity: "-",
      reason: "Trivial documentation task downranked for progression",
      weight: 3,
    });
    score -= 10;
  }

  if (profile.challengePref === "comfortable" && signals.changeComplexity === "high") {
    reasons.push({
      polarity: "-",
      reason: "Complexity above comfortable preference",
      weight: 4,
    });
    score -= 12;
  }
  if (profile.challengePref === "challenge" && signals.changeComplexity === "low") {
    score -= 4;
  }
  if (profile.challengePref === "stretch" && signals.changeComplexity === "medium") {
    reasons.push({
      polarity: "+",
      reason: "Manageable stretch relative to preference",
      weight: 2,
    });
    score += 6;
  }

  const skillOverlapCount = profile.skills.filter((s) =>
    expandTerms([s]).some((t) => blob.includes(t))
  ).length;
  const learningOverlap = profile.learningGoals.filter((s) =>
    expandTerms([s]).some((t) => blob.includes(t))
  ).length;
  if (skillOverlapCount >= 1 && learningOverlap >= 1) {
    reasons.push({
      polarity: "+",
      reason: "Mostly familiar skills with one learning challenge",
      weight: 5,
    });
    score += 12;
  }

  const filtered =
    score < -20 ||
    signals.hasLinkedActivePr ||
    (signals.isArchived) ||
    daysSincePush > 365;

  const uniqueReasons = reasons.filter(
    (r, i, arr) => arr.findIndex((x) => x.reason === r.reason) === i
  );

  return {
    score,
    reasons: uniqueReasons.sort((a, b) => b.weight - a.weight).slice(0, 10),
    filtered,
    filterReason: filtered
      ? signals.hasLinkedActivePr
        ? "active_pr"
        : daysSincePush > 365
          ? "abandoned_repo"
          : score < -20
            ? "low_score"
            : "filtered"
      : undefined,
  };
}
