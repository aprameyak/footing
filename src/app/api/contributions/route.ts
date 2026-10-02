import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createContributionWorkspace } from "@/lib/github/ingest";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { mentorGuidance } from "@/lib/analysis/stuck";
import { createOctokit } from "@/lib/github/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const contribution = await prisma.contribution.findFirst({
      where: { id, userId: session.user.id },
      include: {
        checklistItems: { orderBy: { sortOrder: "asc" } },
        stages: true,
        blockers: { orderBy: { createdAt: "desc" } },
        pullRequests: true,
        outcomes: { orderBy: { createdAt: "desc" } },
        opportunity: {
          include: {
            repository: { include: { analysis: true } },
            issue: { include: { analysis: true, labels: true } },
            matchReasons: { where: { userId: session.user.id } },
          },
        },
      },
    });
    if (!contribution) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(contribution);
  }

  const list = await prisma.contribution.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      opportunity: {
        include: {
          repository: true,
          issue: true,
        },
      },
    },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action as string;

  if (action === "start") {
    const { opportunityId } = z
      .object({ opportunityId: z.string() })
      .parse(body);
    const contribution = await createContributionWorkspace(
      session.user.id,
      opportunityId
    );
    return NextResponse.json({ id: contribution.id });
  }

  if (action === "update_stage") {
    const data = z
      .object({
        contributionId: z.string(),
        stage: z.string(),
        complete: z.boolean().optional(),
      })
      .parse(body);
    await prisma.contribution.update({
      where: { id: data.contributionId },
      data: {
        currentStage: data.stage,
        status:
          data.stage === "implement"
            ? "implementation_in_progress"
            : undefined,
        setupCompletedAt:
          data.stage === "reproduce" || data.complete
            ? new Date()
            : undefined,
      },
    });
    if (data.complete) {
      await prisma.contributionStage.updateMany({
        where: {
          contributionId: data.contributionId,
          stage: data.stage,
        },
        data: { completedAt: new Date() },
      });
      await prisma.contributionOutcome.create({
        data: {
          contributionId: data.contributionId,
          event: `stage_${data.stage}_completed`,
        },
      });
      if (data.stage === "setup") {
        await prisma.contribution.update({
          where: { id: data.contributionId },
          data: {
            setupCompletedAt: new Date(),
            status: "setup_completed",
          },
        });
        await prisma.recommendationEvent.create({
          data: {
            userId: session.user.id,
            event: "setup_completed",
            metadata: { contributionId: data.contributionId },
          },
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_checklist") {
    const data = z
      .object({
        itemId: z.string(),
        checked: z.boolean(),
      })
      .parse(body);
    await prisma.contributionChecklistItem.update({
      where: { id: data.itemId },
      data: { checked: data.checked },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "stuck") {
    const data = z
      .object({
        contributionId: z.string(),
        category: z.string(),
        detail: z.string().optional(),
      })
      .parse(body);
    const contribution = await prisma.contribution.findFirstOrThrow({
      where: { id: data.contributionId, userId: session.user.id },
      include: {
        checklistItems: true,
        opportunity: {
          include: { repository: true, issue: true },
        },
      },
    });
    const setupIncomplete = contribution.checklistItems.some(
      (i) => i.stage === "setup" && !i.checked
    );
    const guidance = mentorGuidance(data.category, {
      repoFullName: contribution.opportunity.repository.fullName,
      issueTitle: contribution.opportunity.issue.title,
      currentStage: contribution.currentStage,
      setupIncomplete,
    });
    const blocker = await prisma.contributionBlocker.create({
      data: {
        contributionId: contribution.id,
        category: data.category,
        detail: data.detail,
        guidance,
      },
    });
    return NextResponse.json({ blocker });
  }

  if (action === "abandon") {
    const data = z
      .object({
        contributionId: z.string(),
        reason: z.string().optional(),
      })
      .parse(body);
    await prisma.contribution.update({
      where: { id: data.contributionId },
      data: {
        status: "abandoned",
        abandonReason: data.reason,
        abandonedAt: new Date(),
      },
    });
    await prisma.contributionOutcome.create({
      data: {
        contributionId: data.contributionId,
        event: "abandoned",
        metadata: { reason: data.reason },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "detect_pr") {
    const data = z.object({ contributionId: z.string() }).parse(body);
    const contribution = await prisma.contribution.findFirstOrThrow({
      where: { id: data.contributionId, userId: session.user.id },
      include: {
        opportunity: {
          include: { repository: true, issue: true },
        },
      },
    });
    const token = session.accessToken || process.env.GITHUB_TOKEN || null;
    const octokit = createOctokit(token);
    const { owner, name } = contribution.opportunity.repository;
    const issueNumber = contribution.opportunity.issue.number;
    const pulls = await octokit.rest.pulls.list({
      owner,
      repo: name,
      state: "all",
      per_page: 30,
      sort: "updated",
      direction: "desc",
    });
    const login = session.user.login;
    const matches = pulls.data.filter((p) => {
      const body = p.body || "";
      const byUser = p.user?.login === login;
      const refsIssue =
        body.includes(`#${issueNumber}`) ||
        p.title.includes(`#${issueNumber}`);
      return byUser || refsIssue;
    });

    for (const pr of matches.slice(0, 5)) {
      await prisma.pullRequest.upsert({
        where: {
          contributionId_number: {
            contributionId: contribution.id,
            number: pr.number,
          },
        },
        create: {
          contributionId: contribution.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          htmlUrl: pr.html_url,
          merged: Boolean(pr.merged_at),
          draft: Boolean(pr.draft),
          createdAtGithub: pr.created_at ? new Date(pr.created_at) : null,
        },
        update: {
          state: pr.state,
          merged: Boolean(pr.merged_at),
          draft: Boolean(pr.draft),
          title: pr.title,
        },
      });
    }

    if (matches.some((p) => p.merged_at)) {
      await prisma.contribution.update({
        where: { id: contribution.id },
        data: { status: "merged", mergedAt: new Date() },
      });
      const langs = await prisma.repositoryLanguage.findMany({
        where: { repositoryId: contribution.opportunity.repositoryId },
      });
      for (const lang of langs.slice(0, 5)) {
        await prisma.skillEvidence.upsert({
          where: {
            userId_skill_source: {
              userId: session.user.id,
              skill: lang.name,
              source: "merged_pr",
            },
          },
          create: {
            userId: session.user.id,
            skill: lang.name,
            source: "merged_pr",
            contributionId: contribution.id,
            count: 1,
          },
          update: { count: { increment: 1 } },
        });
      }
    } else if (matches.length) {
      await prisma.contribution.update({
        where: { id: contribution.id },
        data: {
          status: "pr_submitted",
          prSubmittedAt: new Date(),
          currentStage: "submit",
        },
      });
      await prisma.contributionOutcome.create({
        data: {
          contributionId: contribution.id,
          event: "pr_submitted",
        },
      });
    }

    return NextResponse.json({
      found: matches.length,
      prs: matches.map((p) => ({
        number: p.number,
        htmlUrl: p.html_url,
        state: p.state,
        merged: Boolean(p.merged_at),
      })),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
