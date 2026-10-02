import { prisma } from "@/lib/db/prisma";
import {
  fetchIssueDetail,
  fetchRepositoryBundle,
  fetchTreePaths,
} from "@/lib/github/client";
import { analyzeRepositoryReadiness } from "@/lib/analysis/repository";
import { analyzeIssue } from "@/lib/analysis/issue";
import {
  classifyIssueType,
  estimateChangeComplexity,
  scoreOpportunity,
  type UserMatchProfile,
} from "@/lib/matching/engine";

export async function ingestRepository(
  owner: string,
  repo: string,
  token?: string | null
) {
  const bundle = await fetchRepositoryBundle(owner, repo, token);
  const r = bundle.repo;
  const pushedAt = r.pushed_at ? new Date(r.pushed_at) : null;

  const externalPrs = bundle.recentPulls.filter((p) => {
    const login = p.user?.login || "";
    return login && login !== owner && !login.endsWith("[bot]");
  });

  const readiness = analyzeRepositoryReadiness({
    readme: bundle.readme,
    contributing: bundle.contributing,
    languages: Object.keys(bundle.languages),
    pushedAt,
    recentExternalPrs: externalPrs.length >= 2,
    hasIssueTemplates: Boolean(
      bundle.community?.files?.issue_template ||
        bundle.community?.files?.pull_request_template
    ),
    communityFiles: {
      contributing: Boolean(bundle.community?.files?.contributing),
      readme: Boolean(bundle.community?.files?.readme),
    },
  });

  const repository = await prisma.repository.upsert({
    where: { fullName: `${owner}/${repo}` },
    create: {
      githubId: BigInt(r.id),
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      description: r.description,
      htmlUrl: r.html_url,
      defaultBranch: r.default_branch,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssuesCount: r.open_issues_count,
      license: r.license?.spdx_id || r.license?.key || null,
      isArchived: r.archived,
      isFork: r.fork,
      pushedAt,
      createdAtGithub: r.created_at ? new Date(r.created_at) : null,
      hasContributing: readiness.contributingFound,
      hasReadme: Boolean(bundle.readme),
      hasIssueTemplates: readiness.issueTemplatesFound,
      setupFriction: readiness.setupFriction,
      lastFetchedAt: new Date(),
      lastAnalyzedAt: new Date(),
      rawMetadata: {
        homepage: r.homepage,
        visibility: r.visibility,
      },
    },
    update: {
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssuesCount: r.open_issues_count,
      license: r.license?.spdx_id || r.license?.key || null,
      isArchived: r.archived,
      pushedAt,
      hasContributing: readiness.contributingFound,
      hasReadme: Boolean(bundle.readme),
      hasIssueTemplates: readiness.issueTemplatesFound,
      setupFriction: readiness.setupFriction,
      lastFetchedAt: new Date(),
      lastAnalyzedAt: new Date(),
      defaultBranch: r.default_branch,
    },
  });

  await prisma.repositoryTopic.deleteMany({ where: { repositoryId: repository.id } });
  if (bundle.topics.length) {
    await prisma.repositoryTopic.createMany({
      data: bundle.topics.map((name) => ({ repositoryId: repository.id, name })),
    });
  }

  await prisma.repositoryLanguage.deleteMany({
    where: { repositoryId: repository.id },
  });
  const langEntries = Object.entries(bundle.languages);
  if (langEntries.length) {
    await prisma.repositoryLanguage.createMany({
      data: langEntries.map(([name, bytes]) => ({
        repositoryId: repository.id,
        name,
        bytes,
      })),
    });
  }

  for (const doc of [bundle.readme, bundle.contributing]) {
    if (!doc) continue;
    await prisma.repositoryDocument.upsert({
      where: {
        repositoryId_path: { repositoryId: repository.id, path: doc.path },
      },
      create: {
        repositoryId: repository.id,
        kind: doc.path.toLowerCase().includes("contributing")
          ? "contributing"
          : "readme",
        path: doc.path,
        content: doc.content.slice(0, 200000),
      },
      update: {
        content: doc.content.slice(0, 200000),
        fetchedAt: new Date(),
      },
    });
  }

  await prisma.repositoryAnalysis.upsert({
    where: { repositoryId: repository.id },
    create: {
      repositoryId: repository.id,
      contributingFound: readiness.contributingFound,
      setupDocumented: readiness.setupDocumented,
      testInstructionsFound: readiness.testInstructionsFound,
      issueTemplatesFound: readiness.issueTemplatesFound,
      recentActivity: readiness.recentActivity,
      recentExternalPrs: readiness.recentExternalPrs,
      maintainerResponses: readiness.maintainerResponses,
      claRequired: readiness.claRequired,
      aiPolicy: readiness.aiPolicy,
      setupFriction: readiness.setupFriction,
      setupChecklist: readiness.setupChecklist,
      verifyChecklist: readiness.verifyChecklist,
      analysisJson: readiness,
      analyzedAt: new Date(),
    },
    update: {
      contributingFound: readiness.contributingFound,
      setupDocumented: readiness.setupDocumented,
      testInstructionsFound: readiness.testInstructionsFound,
      issueTemplatesFound: readiness.issueTemplatesFound,
      recentActivity: readiness.recentActivity,
      recentExternalPrs: readiness.recentExternalPrs,
      maintainerResponses: readiness.maintainerResponses,
      claRequired: readiness.claRequired,
      aiPolicy: readiness.aiPolicy,
      setupFriction: readiness.setupFriction,
      setupChecklist: readiness.setupChecklist,
      verifyChecklist: readiness.verifyChecklist,
      analysisJson: readiness,
      analyzedAt: new Date(),
    },
  });

  const opportunities = [];

  for (const issue of bundle.issues.slice(0, 40)) {
    const labels = (issue.labels || []).map((l) =>
      typeof l === "string" ? l : l.name || ""
    ).filter(Boolean);
    const issueType = classifyIssueType(labels, issue.title, issue.body || null);
    const changeComplexity = estimateChangeComplexity(
      issue.title,
      issue.body || null,
      labels
    );

    const dbIssue = await prisma.issue.upsert({
      where: { githubId: BigInt(issue.id) },
      create: {
        githubId: BigInt(issue.id),
        repositoryId: repository.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        htmlUrl: issue.html_url,
        authorLogin: issue.user?.login || null,
        commentsCount: issue.comments,
        assigneeLogins: (issue.assignees || [])
          .map((a) => a.login)
          .filter(Boolean) as string[],
        createdAtGithub: issue.created_at ? new Date(issue.created_at) : null,
        updatedAtGithub: issue.updated_at ? new Date(issue.updated_at) : null,
        lastFetchedAt: new Date(),
      },
      update: {
        title: issue.title,
        body: issue.body,
        state: issue.state,
        commentsCount: issue.comments,
        assigneeLogins: (issue.assignees || [])
          .map((a) => a.login)
          .filter(Boolean) as string[],
        updatedAtGithub: issue.updated_at ? new Date(issue.updated_at) : null,
        lastFetchedAt: new Date(),
      },
    });

    await prisma.issueLabel.deleteMany({ where: { issueId: dbIssue.id } });
    if (labels.length) {
      await prisma.issueLabel.createMany({
        data: labels.map((name) => ({ issueId: dbIssue.id, name })),
      });
    }

    const opportunity = await prisma.opportunity.upsert({
      where: {
        repositoryId_issueId: {
          repositoryId: repository.id,
          issueId: dbIssue.id,
        },
      },
      create: {
        repositoryId: repository.id,
        issueId: dbIssue.id,
        status: "open",
        issueType,
        changeComplexity,
        setupFriction: readiness.setupFriction,
        lastScoredAt: new Date(),
      },
      update: {
        issueType,
        changeComplexity,
        setupFriction: readiness.setupFriction,
        lastScoredAt: new Date(),
        isFiltered: false,
        filteredReason: null,
      },
    });

    opportunities.push({ opportunity, issue: dbIssue, labels });
  }

  return { repository, readiness, opportunities, bundle };
}

export async function rankOpportunitiesForUser(
  userId: string,
  repositoryId: string
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      skills: true,
      learningGoals: true,
      interests: true,
      repositoryInterests: true,
      skillEvidence: true,
    },
  });

  const profile: UserMatchProfile = {
    skills: user.skills.map((s) => s.name),
    learningGoals: user.learningGoals.map((g) => g.name),
    interests: user.interests.map((i) => i.name),
    likedRepos: user.repositoryInterests.map((r) => r.fullName),
    challengePref: (user.challengePref as UserMatchProfile["challengePref"]) || "comfortable",
    experiencedSkills: user.skillEvidence.map((e) => e.skill),
  };

  const repository = await prisma.repository.findUniqueOrThrow({
    where: { id: repositoryId },
    include: {
      languages: true,
      topics: true,
      analysis: true,
      opportunities: {
        include: {
          issue: { include: { labels: true, linkedPrs: true } },
        },
      },
    },
  });

  const results = [];

  for (const opp of repository.opportunities) {
    const labels = opp.issue.labels.map((l) => l.name);
    const hasLinkedActivePr = opp.issue.linkedPrs.some(
      (p) => p.state === "open" && !p.merged
    );
    const scored = scoreOpportunity(profile, {
      title: opp.issue.title,
      body: opp.issue.body,
      labels,
      languages: repository.languages.map((l) => l.name),
      topics: repository.topics.map((t) => t.name),
      repoFullName: repository.fullName,
      updatedAt: opp.issue.updatedAtGithub,
      repoPushedAt: repository.pushedAt,
      hasAssignee: opp.issue.assigneeLogins.length > 0,
      hasLinkedActivePr,
      commentsCount: opp.issue.commentsCount,
      isArchived: repository.isArchived,
      hasContributing: repository.hasContributing,
      setupFriction: (repository.setupFriction as "low" | "moderate" | "high") || "moderate",
      issueType: opp.issueType || "other",
      changeComplexity: (opp.changeComplexity as "low" | "medium" | "high") || "medium",
      codebaseContext: "medium",
    });

    await prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        isFiltered: scored.filtered,
        filteredReason: scored.filterReason || null,
        lastScoredAt: new Date(),
      },
    });

    await prisma.opportunityMatchReason.deleteMany({
      where: { opportunityId: opp.id, userId },
    });
    if (scored.reasons.length) {
      await prisma.opportunityMatchReason.createMany({
        data: scored.reasons.map((r) => ({
          opportunityId: opp.id,
          userId,
          polarity: r.polarity,
          reason: r.reason,
          weight: r.weight,
          score: scored.score,
        })),
      });
    }

    results.push({
      opportunityId: opp.id,
      score: scored.score,
      reasons: scored.reasons,
      filtered: scored.filtered,
      filterReason: scored.filterReason,
      issue: opp.issue,
      issueType: opp.issueType,
      changeComplexity: opp.changeComplexity,
      setupFriction: opp.setupFriction,
    });
  }

  return results
    .filter((r) => !r.filtered)
    .sort((a, b) => b.score - a.score);
}

export async function deepenOpportunityAnalysis(
  opportunityId: string,
  userId: string,
  token?: string | null
) {
  const opportunity = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      repository: {
        include: { languages: true, analysis: true, documents: true },
      },
      issue: { include: { labels: true } },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { skills: true },
  });

  const detail = await fetchIssueDetail(
    opportunity.repository.owner,
    opportunity.repository.name,
    opportunity.issue.number,
    token
  );

  await prisma.issue.update({
    where: { id: opportunity.issue.id },
    data: {
      body: detail.issue.body,
      commentsCount: detail.issue.comments,
      assigneeLogins: (detail.issue.assignees || [])
        .map((a) => a.login)
        .filter(Boolean) as string[],
      updatedAtGithub: detail.issue.updated_at
        ? new Date(detail.issue.updated_at)
        : null,
      lastFetchedAt: new Date(),
    },
  });

  await prisma.issueComment.deleteMany({ where: { issueId: opportunity.issue.id } });
  for (const c of detail.comments) {
    await prisma.issueComment.create({
      data: {
        issueId: opportunity.issue.id,
        githubId: BigInt(c.id),
        authorLogin: c.user?.login || null,
        body: c.body || "",
        createdAtGithub: c.created_at ? new Date(c.created_at) : null,
        authorAssociation: c.author_association,
      },
    });
  }

  await prisma.issueLinkedPullRequest.deleteMany({
    where: { issueId: opportunity.issue.id },
  });
  for (const pr of detail.linkedPrs) {
    await prisma.issueLinkedPullRequest.create({
      data: {
        issueId: opportunity.issue.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        htmlUrl: pr.htmlUrl,
        authorLogin: pr.authorLogin,
        draft: pr.draft,
        merged: pr.merged,
      },
    });
  }

  const treePaths = await fetchTreePaths(
    opportunity.repository.owner,
    opportunity.repository.name,
    opportunity.repository.defaultBranch,
    token
  );

  const hasLinkedActivePr = detail.linkedPrs.some(
    (p) => p.state === "open" && !p.merged
  );
  const analysis = analyzeIssue({
    title: detail.issue.title,
    body: detail.issue.body || null,
    labels: opportunity.issue.labels.map((l) => l.name),
    userSkills: user.skills.map((s) => s.name),
    languages: opportunity.repository.languages.map((l) => l.name),
    setupFriction:
      (opportunity.repository.setupFriction as "low" | "moderate" | "high") ||
      "moderate",
    treePaths,
    hasAssignee: (detail.issue.assignees || []).length > 0,
    hasLinkedActivePr,
    updatedAt: detail.issue.updated_at ? new Date(detail.issue.updated_at) : null,
    repoActive: Boolean(opportunity.repository.analysis?.recentActivity),
    hasContributing: opportunity.repository.hasContributing,
  });

  await prisma.issueAnalysis.upsert({
    where: { issueId: opportunity.issue.id },
    create: {
      issueId: opportunity.issue.id,
      summary: analysis.summary,
      maintainerRequested: analysis.maintainerRequested,
      inferredRequirements: analysis.inferredRequirements,
      knowledgeKnown: analysis.knowledgeKnown,
      knowledgeEncounter: analysis.knowledgeEncounter,
      codeChange: analysis.codeChange,
      codebaseContext: analysis.codebaseContext,
      conceptComplexity: analysis.conceptComplexity,
      setupFriction: analysis.setupFriction,
      difficultyWhy: analysis.difficultyWhy,
      viabilitySignals: analysis.viabilitySignals,
      relevantPaths: analysis.relevantPaths,
      reproduceSteps: analysis.reproduceSteps,
      analysisJson: analysis,
      analyzedAt: new Date(),
    },
    update: {
      summary: analysis.summary,
      maintainerRequested: analysis.maintainerRequested,
      inferredRequirements: analysis.inferredRequirements,
      knowledgeKnown: analysis.knowledgeKnown,
      knowledgeEncounter: analysis.knowledgeEncounter,
      codeChange: analysis.codeChange,
      codebaseContext: analysis.codebaseContext,
      conceptComplexity: analysis.conceptComplexity,
      setupFriction: analysis.setupFriction,
      difficultyWhy: analysis.difficultyWhy,
      viabilitySignals: analysis.viabilitySignals,
      relevantPaths: analysis.relevantPaths,
      reproduceSteps: analysis.reproduceSteps,
      analysisJson: analysis,
      analyzedAt: new Date(),
    },
  });

  await prisma.recommendationEvent.create({
    data: {
      userId,
      opportunityId,
      event: "investigated",
    },
  });

  return {
    opportunity,
    analysis,
    repositoryAnalysis: opportunity.repository.analysis,
    linkedPrs: detail.linkedPrs,
    comments: detail.comments,
  };
}

export async function createContributionWorkspace(
  userId: string,
  opportunityId: string
) {
  const existing = await prisma.contribution.findFirst({
    where: {
      userId,
      opportunityId,
      status: { notIn: ["abandoned", "merged", "closed"] },
    },
  });
  if (existing) return existing;

  const opportunity = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      repository: { include: { analysis: true } },
      issue: { include: { analysis: true } },
    },
  });

  const contribution = await prisma.contribution.create({
    data: {
      userId,
      opportunityId,
      status: "started",
      currentStage: "understand",
      stages: {
        create: [
          "understand",
          "setup",
          "reproduce",
          "investigate",
          "implement",
          "verify",
          "submit",
        ].map((stage) => ({ stage })),
      },
      outcomes: {
        create: { event: "started" },
      },
    },
  });

  const setupItems =
    (opportunity.repository.analysis?.setupChecklist as Array<{
      label: string;
      source?: string | null;
      inferred?: boolean;
      confidence?: string;
    }> | null) || [];

  const verifyItems =
    (opportunity.repository.analysis?.verifyChecklist as Array<{
      label: string;
      source?: string | null;
      inferred?: boolean;
      confidence?: string;
    }> | null) || [];

  const reproduceItems =
    (opportunity.issue.analysis?.reproduceSteps as Array<{
      label: string;
      source?: string;
      inferred?: boolean;
      confidence?: string;
    }> | null) || [];

  const checklistData = [
    ...setupItems.map((item, i) => ({
      contributionId: contribution.id,
      stage: "setup",
      label: item.label,
      provenancePath: item.source || null,
      provenanceKind: item.inferred ? "inferred" : "document",
      inferred: Boolean(item.inferred),
      confidence: item.confidence || "medium",
      sortOrder: i,
    })),
    ...reproduceItems.map((item, i) => ({
      contributionId: contribution.id,
      stage: "reproduce",
      label: item.label,
      provenancePath: item.source || null,
      provenanceKind: item.inferred ? "suggested" : "maintainer",
      inferred: Boolean(item.inferred),
      confidence: item.confidence || "medium",
      sortOrder: i,
    })),
    ...verifyItems.map((item, i) => ({
      contributionId: contribution.id,
      stage: "verify",
      label: item.label,
      provenancePath: item.source || null,
      provenanceKind: item.inferred ? "inferred" : "document",
      inferred: Boolean(item.inferred),
      confidence: item.confidence || "medium",
      sortOrder: i,
    })),
    {
      contributionId: contribution.id,
      stage: "submit",
      label: "Review your diff against the issue acceptance criteria",
      provenancePath: null,
      provenanceKind: "suggested",
      inferred: true,
      confidence: "medium",
      sortOrder: 0,
    },
    {
      contributionId: contribution.id,
      stage: "submit",
      label: "Run required local checks from VERIFY",
      provenancePath: null,
      provenanceKind: "suggested",
      inferred: true,
      confidence: "medium",
      sortOrder: 1,
    },
    {
      contributionId: contribution.id,
      stage: "submit",
      label: "Commit with a clear message referencing the issue",
      provenancePath: null,
      provenanceKind: "suggested",
      inferred: true,
      confidence: "high",
      sortOrder: 2,
    },
    {
      contributionId: contribution.id,
      stage: "submit",
      label: "Push branch and open a pull request",
      provenancePath: null,
      provenanceKind: "suggested",
      inferred: true,
      confidence: "high",
      sortOrder: 3,
    },
    {
      contributionId: contribution.id,
      stage: "submit",
      label: "Fill PR template / confirm contribution requirements",
      provenancePath: null,
      provenanceKind: "suggested",
      inferred: true,
      confidence: "high",
      sortOrder: 4,
    },
  ];

  if (checklistData.length) {
    await prisma.contributionChecklistItem.createMany({ data: checklistData });
  }

  await prisma.recommendationEvent.create({
    data: {
      userId,
      opportunityId,
      event: "contribution_started",
    },
  });

  return contribution;
}
