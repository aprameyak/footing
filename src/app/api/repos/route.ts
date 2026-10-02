import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseGitHubInput } from "@/lib/utils/github-parse";
import {
  ingestRepository,
  rankOpportunitiesForUser,
  deepenOpportunityAnalysis,
} from "@/lib/github/ingest";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = z.object({ input: z.string().min(3) }).parse(await req.json());
  const parsed = parseGitHubInput(body.input);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse GitHub repository or issue URL" },
      { status: 400 }
    );
  }

  const token = session.accessToken || process.env.GITHUB_TOKEN || null;

  try {
    const { repository } = await ingestRepository(
      parsed.owner,
      parsed.repo,
      token
    );

    await prisma.userRepositoryInterest.upsert({
      where: {
        userId_fullName: {
          userId: session.user.id,
          fullName: repository.fullName,
        },
      },
      create: {
        userId: session.user.id,
        fullName: repository.fullName,
        repositoryId: repository.id,
      },
      update: { repositoryId: repository.id },
    });

    let focusOpportunityId: string | null = null;

    if (parsed.kind === "issue") {
      const issue = await prisma.issue.findFirst({
        where: {
          repositoryId: repository.id,
          number: parsed.number,
        },
        include: { opportunities: true },
      });
      if (issue?.opportunities[0]) {
        focusOpportunityId = issue.opportunities[0].id;
        await deepenOpportunityAnalysis(
          focusOpportunityId,
          session.user.id,
          token
        );
      } else {
        const detailIngest = await ingestRepository(
          parsed.owner,
          parsed.repo,
          token
        );
        const created = detailIngest.opportunities.find(
          (o) => o.issue.number === parsed.number
        );
        if (created) {
          focusOpportunityId = created.opportunity.id;
          await deepenOpportunityAnalysis(
            focusOpportunityId,
            session.user.id,
            token
          );
        }
      }
    }

    const ranked = await rankOpportunitiesForUser(
      session.user.id,
      repository.id
    );

    await prisma.recommendationEvent.create({
      data: {
        userId: session.user.id,
        opportunityId: focusOpportunityId,
        event: "repo_analyzed",
        metadata: { fullName: repository.fullName, input: body.input },
      },
    });

    return NextResponse.json({
      repositoryId: repository.id,
      fullName: repository.fullName,
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
        labels: undefined,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
