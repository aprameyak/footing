import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseGitHubInput } from "@/lib/utils/github-parse";
import {
  ingestRepository,
  ingestSingleIssue,
  rankOpportunitiesForUser,
  deepenOpportunityAnalysis,
} from "@/lib/github/ingest";
import { prisma } from "@/lib/db/prisma";
import { toJson } from "@/lib/utils/json";
import { z } from "zod";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = z.object({ input: z.string().min(3) }).safeParse(json);
  if (!body.success) {
    return NextResponse.json(
      { error: "Provide a GitHub repository or issue URL" },
      { status: 400 }
    );
  }
  const parsed = parseGitHubInput(body.data.input);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse GitHub repository or issue URL" },
      { status: 400 }
    );
  }

  const token = session.accessToken || process.env.GITHUB_TOKEN || null;

  try {
    let repositoryId: string;
    let fullName: string;
    let focusOpportunityId: string | null = null;

    if (parsed.kind === "issue") {
      const single = await ingestSingleIssue(
        parsed.owner,
        parsed.repo,
        parsed.number,
        token
      );
      repositoryId = single.repository.id;
      fullName = single.repository.fullName;
      focusOpportunityId = single.opportunity.id;
      await deepenOpportunityAnalysis(
        focusOpportunityId,
        session.user.id,
        token
      );
    } else {
      const { repository } = await ingestRepository(
        parsed.owner,
        parsed.repo,
        token
      );
      repositoryId = repository.id;
      fullName = repository.fullName;
    }

    await prisma.userRepositoryInterest.upsert({
      where: {
        userId_fullName: {
          userId: session.user.id,
          fullName,
        },
      },
      create: {
        userId: session.user.id,
        fullName,
        repositoryId,
      },
      update: { repositoryId },
    });

    const ranked = await rankOpportunitiesForUser(
      session.user.id,
      repositoryId
    );

    await prisma.recommendationEvent.create({
      data: {
        userId: session.user.id,
        opportunityId: focusOpportunityId,
        event: "repo_analyzed",
        metadata: { fullName, input: body.data.input },
      },
    });

    const issueIds = ranked.slice(0, 20).map((r) => r.issue.id);
    const labelRows = await prisma.issueLabel.findMany({
      where: { issueId: { in: issueIds } },
    });
    const labelsByIssue = new Map<string, string[]>();
    for (const row of labelRows) {
      const list = labelsByIssue.get(row.issueId) || [];
      list.push(row.name);
      labelsByIssue.set(row.issueId, list);
    }

    return NextResponse.json(
      toJson({
        repositoryId,
        fullName,
        focusOpportunityId,
        opportunities: ranked.slice(0, 20).map((r) => ({
          id: r.opportunityId,
          score: r.score,
          reasons: r.reasons,
          title: r.issue.title,
          number: r.issue.number,
          htmlUrl: r.issue.htmlUrl,
          issueType: r.issueType,
          changeComplexity: r.changeComplexity,
          setupFriction: r.setupFriction,
          updatedAt: r.issue.updatedAtGithub,
          labels: labelsByIssue.get(r.issue.id) || [],
        })),
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
