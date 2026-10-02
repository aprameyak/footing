export type ParsedGitHubRef =
  | { kind: "repo"; owner: string; repo: string }
  | { kind: "issue"; owner: string; repo: string; number: number };

export function parseGitHubInput(input: string): ParsedGitHubRef | null {
  const raw = input.trim().replace(/\/$/, "");
  if (!raw) return null;

  const issueUrl =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)/i.exec(
      raw
    );
  if (issueUrl) {
    return {
      kind: "issue",
      owner: issueUrl[1],
      repo: issueUrl[2].replace(/\.git$/, ""),
      number: Number(issueUrl[3]),
    };
  }

  const repoUrl =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(raw);
  if (repoUrl) {
    return {
      kind: "repo",
      owner: repoUrl[1],
      repo: repoUrl[2].replace(/\.git$/, ""),
    };
  }

  const short = /^([^/\s]+)\/([^/\s#?]+)$/.exec(raw);
  if (short) {
    return {
      kind: "repo",
      owner: short[1],
      repo: short[2].replace(/\.git$/, ""),
    };
  }

  return null;
}

export const SKILL_SUGGESTIONS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "React",
  "Next.js",
  "Node.js",
  "PostgreSQL",
  "Docker",
  "CSS",
  "Vue",
  "Svelte",
  "C++",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "GraphQL",
];

export const INTEREST_SUGGESTIONS = [
  "Developer tools",
  "Fintech",
  "Self-hosted software",
  "Language learning",
  "Databases",
  "AI infrastructure",
  "Productivity",
  "Security",
  "Data visualization",
  "Web frameworks",
  "CLI tools",
  "Documentation",
  "Testing",
  "Accessibility",
];

export const CONTRIBUTION_STAGES = [
  "understand",
  "setup",
  "reproduce",
  "investigate",
  "implement",
  "verify",
  "submit",
] as const;

export const STUCK_CATEGORIES = [
  { id: "repo_wont_run", label: "Repo won't run" },
  { id: "dependency", label: "Dependency/install problem" },
  { id: "cant_reproduce", label: "I can't reproduce the issue" },
  { id: "dont_understand_code", label: "I don't understand the code" },
  { id: "dont_know_where", label: "I don't know where to start" },
  { id: "tests_failing", label: "Tests are failing" },
  { id: "ci_failing", label: "CI is failing" },
  { id: "git_problem", label: "Git problem" },
  { id: "maintainer_changes", label: "Maintainer requested changes" },
  { id: "other", label: "Other" },
] as const;

export const ABANDON_REASONS = [
  { id: "setup_hard", label: "Setup too difficult" },
  { id: "already_taken", label: "Issue already taken" },
  { id: "harder_than_expected", label: "Task harder than expected" },
  { id: "lost_interest", label: "Lost interest" },
  { id: "codebase_confusing", label: "Couldn't understand codebase" },
  { id: "maintainer_unresponsive", label: "Maintainer unresponsive" },
  { id: "other", label: "Other" },
] as const;
