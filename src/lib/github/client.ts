import { Octokit } from "@octokit/rest";

export function createOctokit(token?: string | null) {
  return new Octokit({
    auth: token || process.env.GITHUB_TOKEN || undefined,
    userAgent: "footing-oss-contributor",
    request: {
      retries: 1,
    },
  });
}

export type RepoBundle = {
  repo: Awaited<ReturnType<Octokit["rest"]["repos"]["get"]>>["data"];
  languages: Record<string, number>;
  topics: string[];
  readme: { path: string; content: string } | null;
  contributing: { path: string; content: string } | null;
  issues: Awaited<
    ReturnType<Octokit["rest"]["issues"]["listForRepo"]>
  >["data"];
  recentPulls: Awaited<
    ReturnType<Octokit["rest"]["pulls"]["list"]>
  >["data"];
  community: Awaited<
    ReturnType<Octokit["rest"]["repos"]["getCommunityProfileMetrics"]>
  >["data"] | null;
};

async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  candidates: string[]
): Promise<{ path: string; content: string } | null> {
  for (const path of candidates) {
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path });
      if (!Array.isArray(res.data) && res.data.type === "file" && res.data.content) {
        const content = Buffer.from(res.data.content, "base64").toString("utf8");
        return { path, content };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchRepositoryBundle(
  owner: string,
  repo: string,
  token?: string | null
): Promise<RepoBundle> {
  const octokit = createOctokit(token);

  const [repoRes, languagesRes, issuesRes, pullsRes] = await Promise.all([
    octokit.rest.repos.get({ owner, repo }),
    octokit.rest.repos.listLanguages({ owner, repo }),
    octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 50,
      sort: "updated",
      direction: "desc",
    }),
    octokit.rest.pulls.list({
      owner,
      repo,
      state: "closed",
      per_page: 30,
      sort: "updated",
      direction: "desc",
    }),
  ]);

  let community = null;
  try {
    const communityRes = await octokit.rest.repos.getCommunityProfileMetrics({
      owner,
      repo,
    });
    community = communityRes.data;
  } catch {
    community = null;
  }

  const [readme, contributing] = await Promise.all([
    getFileContent(octokit, owner, repo, [
      "README.md",
      "README.MD",
      "readme.md",
      "README",
    ]),
    getFileContent(octokit, owner, repo, [
      "CONTRIBUTING.md",
      "CONTRIBUTING.MD",
      ".github/CONTRIBUTING.md",
      "docs/CONTRIBUTING.md",
      "CONTRIBUTING",
    ]),
  ]);

  const topics =
    (repoRes.data as { topics?: string[] }).topics ||
    (
      await octokit.rest.repos
        .getAllTopics({ owner, repo })
        .catch(() => ({ data: { names: [] as string[] } }))
    ).data.names;

  return {
    repo: repoRes.data,
    languages: languagesRes.data,
    topics,
    readme,
    contributing,
    issues: issuesRes.data.filter((i) => !i.pull_request),
    recentPulls: pullsRes.data,
    community,
  };
}

export async function fetchIssueDetail(
  owner: string,
  repo: string,
  number: number,
  token?: string | null
) {
  const octokit = createOctokit(token);
  const [issue, comments, timeline] = await Promise.all([
    octokit.rest.issues.get({ owner, repo, issue_number: number }),
    octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: number,
      per_page: 30,
    }),
    octokit.rest.issues
      .listEventsForTimeline({
        owner,
        repo,
        issue_number: number,
        per_page: 50,
      })
      .catch(() => ({ data: [] as unknown[] })),
  ]);

  const linkedPrs: Array<{
    number: number;
    title?: string;
    state: string;
    htmlUrl: string;
    authorLogin?: string;
    draft: boolean;
    merged: boolean;
  }> = [];

  for (const event of timeline.data as Array<Record<string, unknown>>) {
    const source = event.source as
      | { issue?: { pull_request?: unknown; number?: number; title?: string; state?: string; html_url?: string; user?: { login?: string }; draft?: boolean; merged_at?: string } }
      | undefined;
    if (event.event === "cross-referenced" && source?.issue?.pull_request) {
      const pr = source.issue;
      linkedPrs.push({
        number: pr.number!,
        title: pr.title,
        state: pr.state || "open",
        htmlUrl: pr.html_url || "",
        authorLogin: pr.user?.login,
        draft: Boolean(pr.draft),
        merged: Boolean(pr.merged_at),
      });
    }
  }

  const bodyMentions = (issue.data.body || "").match(
    /#(\d+)/g
  );
  if (bodyMentions) {
    for (const m of bodyMentions.slice(0, 5)) {
      const n = Number(m.slice(1));
      if (linkedPrs.some((p) => p.number === n)) continue;
      try {
        const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: n });
        linkedPrs.push({
          number: pr.data.number,
          title: pr.data.title,
          state: pr.data.state,
          htmlUrl: pr.data.html_url,
          authorLogin: pr.data.user?.login || undefined,
          draft: Boolean(pr.data.draft),
          merged: Boolean(pr.data.merged),
        });
      } catch {
        continue;
      }
    }
  }

  return { issue: issue.data, comments: comments.data, linkedPrs };
}

export async function fetchTreePaths(
  owner: string,
  repo: string,
  branch: string,
  token?: string | null
): Promise<string[]> {
  const octokit = createOctokit(token);
  try {
    const ref = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "true",
    });
    return (ref.data.tree || [])
      .filter((t) => t.type === "blob" && t.path)
      .map((t) => t.path!)
      .slice(0, 4000);
  } catch {
    return [];
  }
}
