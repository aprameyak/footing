export type ChecklistItem = {
  label: string;
  source: string | null;
  confidence: "high" | "medium" | "low";
  inferred: boolean;
};

export type RepoReadiness = {
  contributingFound: boolean;
  setupDocumented: boolean;
  testInstructionsFound: boolean;
  issueTemplatesFound: boolean;
  recentActivity: boolean;
  recentExternalPrs: boolean;
  maintainerResponses: string;
  claRequired: "required" | "not_detected";
  aiPolicy: "found" | "not_detected";
  setupFriction: "low" | "moderate" | "high";
  setupChecklist: ChecklistItem[];
  verifyChecklist: ChecklistItem[];
};

function extractCommandLines(doc: string, source: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const fence = /```(?:bash|sh|shell|zsh|console)?\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(doc)) !== null) {
    const lines = match[1].split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^\$\s*/, "").trim();
      if (!cleaned || cleaned.startsWith("#")) continue;
      if (
        /^(npm|pnpm|yarn|bun|pip|poetry|cargo|go|make|docker|composer|bundle|gradle|mvn|rails|dotnet)\b/.test(
          cleaned
        ) ||
        /^(cd|cp|cp\s|mkdir|git\s+clone|git\s+fork)/.test(cleaned)
      ) {
        items.push({
          label: cleaned.length > 120 ? cleaned.slice(0, 117) + "..." : cleaned,
          source,
          confidence: "high",
          inferred: false,
        });
      }
    }
  }

  const bulletCmds =
    /^[-*]\s+`([^`]+)`/gim;
  while ((match = bulletCmds.exec(doc)) !== null) {
    const cmd = match[1].trim();
    if (/^(npm|pnpm|yarn|bun|pip|cargo|make|docker)/.test(cmd)) {
      items.push({
        label: cmd,
        source,
        confidence: "medium",
        inferred: false,
      });
    }
  }

  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.label)) return false;
    seen.add(i.label);
    return true;
  });
}

function detectSetupFriction(
  docs: string,
  languages: string[]
): "low" | "moderate" | "high" {
  const blob = docs.toLowerCase();
  let friction = 0;
  if (/docker|docker-compose|compose\.ya?ml/.test(blob)) friction += 2;
  if (/postgres|mysql|mongodb|redis|elasticsearch/.test(blob)) friction += 2;
  if (/aws|gcp|azure|kubernetes|k8s/.test(blob)) friction += 3;
  if (/\.env|environment variable/.test(blob)) friction += 1;
  if (/multiple services|microservices/.test(blob)) friction += 2;
  if (languages.includes("C++") || languages.includes("Rust")) friction += 1;
  if (/pnpm install|npm install|yarn|pip install|cargo build/.test(blob) && friction === 0) {
    return "low";
  }
  if (friction >= 5) return "high";
  if (friction >= 2) return "moderate";
  return "low";
}

export function analyzeRepositoryReadiness(input: {
  readme: { path: string; content: string } | null;
  contributing: { path: string; content: string } | null;
  languages: string[];
  pushedAt: Date | null;
  recentExternalPrs: boolean;
  hasIssueTemplates: boolean;
  communityFiles?: { contributing?: boolean; readme?: boolean } | null;
}): RepoReadiness {
  const contributingFound = Boolean(
    input.contributing?.content || input.communityFiles?.contributing
  );
  const docs = [
    input.contributing
      ? { path: input.contributing.path, content: input.contributing.content }
      : null,
    input.readme ? { path: input.readme.path, content: input.readme.content } : null,
  ].filter(Boolean) as { path: string; content: string }[];

  const setupChecklist: ChecklistItem[] = [
    {
      label: "Fork repository",
      source: null,
      confidence: "high",
      inferred: true,
    },
    {
      label: "Clone your fork",
      source: null,
      confidence: "high",
      inferred: true,
    },
  ];

  const verifyChecklist: ChecklistItem[] = [];

  for (const doc of docs) {
    const cmds = extractCommandLines(doc.content, doc.path);
    for (const cmd of cmds) {
      if (/test|lint|typecheck|check|ci|vitest|jest|playwright|cypress/.test(cmd.label)) {
        verifyChecklist.push(cmd);
      } else if (
        /install|dev|start|build|setup|bootstrap|migrate|docker|env|compose/.test(
          cmd.label
        )
      ) {
        setupChecklist.push(cmd);
      } else {
        setupChecklist.push(cmd);
      }
    }
  }

  const allText = docs.map((d) => d.content).join("\n");
  const setupDocumented =
    setupChecklist.filter((c) => !c.inferred).length > 0 ||
    /getting started|development setup|local development|installation/i.test(allText);
  const testInstructionsFound =
    verifyChecklist.length > 0 || /npm test|pnpm test|yarn test|pytest|cargo test/i.test(allText);

  if (/\.env\.example|\.env\.sample/i.test(allText)) {
    setupChecklist.push({
      label: "Copy .env.example → .env (see docs)",
      source: docs[0]?.path || "README.md",
      confidence: "medium",
      inferred: false,
    });
  }

  const setupFriction = detectSetupFriction(allText, input.languages);
  const recentActivity = input.pushedAt
    ? Date.now() - input.pushedAt.getTime() < 1000 * 60 * 60 * 24 * 60
    : false;

  const claRequired = /contributor license agreement|\bCLA\b|DCO|sign-off/i.test(allText)
    ? "required"
    : "not_detected";
  const aiPolicy = /ai[- ]generated|chatgpt|copilot policy|llm contribution/i.test(allText)
    ? "found"
    : "not_detected";

  return {
    contributingFound,
    setupDocumented,
    testInstructionsFound,
    issueTemplatesFound: input.hasIssueTemplates,
    recentActivity,
    recentExternalPrs: input.recentExternalPrs,
    maintainerResponses: recentActivity ? "Recent activity observed" : "Unclear",
    claRequired,
    aiPolicy,
    setupFriction,
    setupChecklist: setupChecklist.slice(0, 16),
    verifyChecklist: verifyChecklist.slice(0, 12),
  };
}
