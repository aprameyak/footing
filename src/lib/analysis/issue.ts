import {
  classifyIssueType,
  estimateChangeComplexity,
  estimateCodebaseContext,
} from "@/lib/matching/engine";

export type RelevantPath = {
  path: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  inferred: true;
};

export type ReproduceStep = {
  label: string;
  source: "maintainer" | "suggested";
  confidence: "high" | "medium" | "low";
  inferred: boolean;
};

export type IssueAnalysisResult = {
  summary: string;
  maintainerRequested: string | null;
  inferredRequirements: string | null;
  knowledgeKnown: string[];
  knowledgeEncounter: string[];
  codeChange: "low" | "medium" | "high";
  codebaseContext: "low" | "medium" | "high";
  conceptComplexity: "low" | "medium" | "high";
  setupFriction: "low" | "moderate" | "high";
  difficultyWhy: string;
  viabilitySignals: Array<{ label: string; ok: boolean; note?: string }>;
  relevantPaths: RelevantPath[];
  reproduceSteps: ReproduceStep[];
  issueType: string;
};

const TECH_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "React", re: /\breact\b/i },
  { name: "TypeScript", re: /\btypescript\b|\bts\b|\btsx\b/i },
  { name: "JavaScript", re: /\bjavascript\b|\bjs\b/i },
  { name: "Next.js", re: /\bnext\.?js\b/i },
  { name: "Node.js", re: /\bnode\.?js\b/i },
  { name: "CSS", re: /\bcss\b|\btailwind\b|\bstyled-components\b/i },
  { name: "Playwright", re: /\bplaywright\b/i },
  { name: "Jest", re: /\bjest\b/i },
  { name: "Vitest", re: /\bvitest\b/i },
  { name: "Cypress", re: /\bcypress\b/i },
  { name: "PostgreSQL", re: /\bpostgres(ql)?\b/i },
  { name: "Docker", re: /\bdocker\b/i },
  { name: "Python", re: /\bpython\b|\bpydantic\b/i },
  { name: "Go", re: /\bgolang\b|\bgo module\b/i },
  { name: "Rust", re: /\brust\b|\bcargo\b/i },
  { name: "GraphQL", re: /\bgraphql\b/i },
  { name: "Vue", re: /\bvue\b/i },
  { name: "Testing Library", re: /\btesting-library\b/i },
];

function extractQuotedRequirements(body: string): string | null {
  const acceptance = /acceptance criteria[:\s]*([\s\S]{20,400})/i.exec(body);
  if (acceptance) return acceptance[1].trim().split(/\n\n/)[0].slice(0, 400);
  const expected = /expected (?:behavior|result)[:\s]*([\s\S]{20,300})/i.exec(body);
  if (expected) return expected[1].trim().split(/\n\n/)[0].slice(0, 300);
  return null;
}

function extractReproduceSteps(body: string): ReproduceStep[] {
  const steps: ReproduceStep[] = [];
  const section =
    /(?:steps to reproduce|reproduce|reproduction)[:\s]*([\s\S]{10,800})/i.exec(
      body
    );
  if (!section) return steps;
  const lines = section[1].split("\n").slice(0, 20);
  for (const line of lines) {
    const m = /^[\s]*(?:\d+[.)]\s+|[-*]\s+)(.+)/.exec(line);
    if (m && m[1].trim().length > 3) {
      steps.push({
        label: m[1].trim(),
        source: "maintainer",
        confidence: "high",
        inferred: false,
      });
    }
  }
  return steps.slice(0, 10);
}

function scorePathRelevance(
  path: string,
  title: string,
  body: string,
  labels: string[]
): number {
  const blob = [title, body, ...labels].join(" ").toLowerCase();
  const parts = path.toLowerCase().split("/");
  const file = parts[parts.length - 1] || "";
  let score = 0;
  const tokens = blob
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
  for (const t of tokens) {
    if (file.includes(t) || path.toLowerCase().includes(t)) score += 3;
  }
  if (/nav|menu|header|sidebar|layout/.test(blob) && /nav|menu|header|sidebar|layout/.test(path.toLowerCase())) {
    score += 8;
  }
  if (/test|spec/.test(blob) && /\.(test|spec)\./.test(file)) score += 6;
  if (/css|style|overflow|layout/.test(blob) && /\.(css|scss|module\.css)$/.test(file)) {
    score += 5;
  }
  if (/readme|doc/.test(blob) && /readme|docs\//.test(path.toLowerCase())) score += 7;
  return score;
}

export function analyzeIssue(input: {
  title: string;
  body: string | null;
  labels: string[];
  userSkills: string[];
  languages: string[];
  setupFriction: "low" | "moderate" | "high";
  treePaths: string[];
  hasAssignee: boolean;
  hasLinkedActivePr: boolean;
  updatedAt: Date | null;
  repoActive: boolean;
  hasContributing: boolean;
}): IssueAnalysisResult {
  const body = input.body || "";
  const issueType = classifyIssueType(input.labels, input.title, body);
  const codeChange = estimateChangeComplexity(input.title, body, input.labels);
  const codebaseContext = estimateCodebaseContext(body, input.labels);

  let conceptComplexity: "low" | "medium" | "high" = "medium";
  if (/typo|docs|copy|label|css|style|test/.test([input.title, ...input.labels].join(" ").toLowerCase())) {
    conceptComplexity = "low";
  }
  if (/architect|protocol|concurrency|distributed|security|crypto/.test((input.title + body).toLowerCase())) {
    conceptComplexity = "high";
  }

  const detectedTechs = TECH_PATTERNS.filter((t) =>
    t.re.test([input.title, body, ...input.labels, ...input.languages].join(" "))
  ).map((t) => t.name);

  const skillSet = new Set(input.userSkills.map((s) => s.toLowerCase()));
  const knowledgeKnown = detectedTechs.filter((t) => skillSet.has(t.toLowerCase()));
  const knowledgeEncounter = detectedTechs.filter((t) => !skillSet.has(t.toLowerCase()));

  const maintainerRequested = extractQuotedRequirements(body);
  const inferredRequirements = !maintainerRequested
    ? `Based on the title and description, the contribution appears related to: ${input.title}. Confirm details on the issue before implementing.`
    : null;

  const summaryParts = [
    `Issue type appears to be ${issueType}.`,
    body
      ? body.replace(/\s+/g, " ").trim().slice(0, 280)
      : "The issue body is empty or missing.",
  ];
  if (issueType === "bug") {
    summaryParts.unshift(
      "This looks like a bug fix: reproduce the reported behavior, adjust the relevant code, and add or update a regression check if the project has tests."
    );
  } else if (issueType === "tests") {
    summaryParts.unshift(
      "This looks like a testing contribution: understand the behavior under test, locate existing test patterns, and extend coverage without changing product behavior unless requested."
    );
  } else if (issueType === "documentation") {
    summaryParts.unshift(
      "This looks like a documentation change: verify the described behavior against the codebase, then update the relevant docs."
    );
  }

  const reproduceSteps = extractReproduceSteps(body);
  if (issueType === "bug" && reproduceSteps.length === 0) {
    reproduceSteps.push(
      {
        label: "Start the development server using documented setup",
        source: "suggested",
        confidence: "low",
        inferred: true,
      },
      {
        label: "Follow any UI or API path described in the issue",
        source: "suggested",
        confidence: "low",
        inferred: true,
      },
      {
        label: "Compare observed behavior to the expected behavior in the issue",
        source: "suggested",
        confidence: "medium",
        inferred: true,
      }
    );
  }

  const scored = input.treePaths
    .map((path) => ({
      path,
      score: scorePathRelevance(path, input.title, body, input.labels),
    }))
    .filter((x) => x.score >= 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const relevantPaths: RelevantPath[] = scored.map((s) => ({
    path: s.path,
    reason:
      s.score >= 12
        ? "Strong lexical overlap with issue title/body"
        : "Possible related file based on naming and issue terms",
    confidence: s.score >= 12 ? "high" : s.score >= 8 ? "medium" : "low",
    inferred: true,
  }));

  const days = input.updatedAt
    ? (Date.now() - input.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  const viabilitySignals = [
    { label: "Open issue", ok: true },
    {
      label: "No active linked PR found",
      ok: !input.hasLinkedActivePr,
      note: input.hasLinkedActivePr
        ? "An active linked PR was detected — treat as possibly claimed"
        : "No active work was detected via linked PRs",
    },
    {
      label: "No assignee",
      ok: !input.hasAssignee,
      note: input.hasAssignee ? "Someone is assigned on GitHub" : undefined,
    },
    {
      label: "Recent issue activity",
      ok: days <= 60,
      note: days > 60 ? "Issue has been quiet for a while" : undefined,
    },
    {
      label: "Repository recently active",
      ok: input.repoActive,
    },
    {
      label: "Contribution guide exists",
      ok: input.hasContributing,
    },
  ];

  const difficultyWhy = [
    `Code change: ${codeChange}.`,
    `Codebase context: ${codebaseContext}.`,
    `Concept complexity: ${conceptComplexity}.`,
    `Setup friction: ${input.setupFriction}.`,
    codeChange === "low" && input.setupFriction !== "low"
      ? "Change may be localized, but environment setup adds friction."
      : codeChange === "high"
        ? "Issue language suggests broader or deeper changes."
        : "Difficulty dimensions are independent — setup and code change can differ.",
  ].join(" ");

  return {
    summary: summaryParts.join(" "),
    maintainerRequested,
    inferredRequirements,
    knowledgeKnown,
    knowledgeEncounter: knowledgeEncounter.slice(0, 6),
    codeChange,
    codebaseContext,
    conceptComplexity,
    setupFriction: input.setupFriction,
    difficultyWhy,
    viabilitySignals,
    relevantPaths,
    reproduceSteps,
    issueType,
  };
}
