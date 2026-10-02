const GUIDANCE: Record<string, string> = {
  repo_wont_run:
    "Confirm you followed only documented setup steps. Check whether the failing command appears in CONTRIBUTING/README. Compare Node/package manager versions to what the repo documents. Prefer fixing environment drift before changing application code.",
  dependency:
    "Delete lockfile-adjacent install artifacts only if docs suggest it. Check peer dependency warnings against the package manager the repo uses. Search closed issues for the same install error — many OSS repos have known version pins.",
  cant_reproduce:
    "Re-read the issue for environment assumptions (browser, viewport, OS, feature flags). Try on a clean branch from the default branch. Ask on the issue only after documenting exact steps you tried.",
  dont_understand_code:
    "Start from the entry point related to the bug (route, component, or CLI command), then jump to definitions. Read nearby tests before the implementation — tests often state intended behavior more clearly.",
  dont_know_where:
    "Search the repo for distinctive strings from the issue title. Open files already flagged as suggested starting points, then find imports/callers. Do not broaden scope until you can name the function you think owns the behavior.",
  tests_failing:
    "Check whether the failing test already fails on the default branch. If it only fails on your branch, read the assertion and the code path it covers before changing production code.",
  ci_failing:
    "Open the failing CI job log and identify the first real error, not the last. Reproduce that command locally. Avoid drive-by formatting/lint changes unrelated to your PR.",
  git_problem:
    "Keep your branch rebased or merged with the default branch per the project's CONTRIBUTING preference. Avoid force-pushing to shared branches. If unsure, create a fresh branch from upstream/main and cherry-pick your commits.",
  maintainer_changes:
    "Address each review comment in order. Prefer small follow-up commits or an amended history only if the project asks for squash. Ask clarifying questions on the PR when a request conflicts with another comment.",
  other:
    "State the blocker in one sentence, list what you already tried, and point to the exact file or command involved. Mentors and maintainers can help much faster with that context.",
};

export function mentorGuidance(category: string, context: {
  repoFullName: string;
  issueTitle: string;
  currentStage: string;
  setupIncomplete: boolean;
}): string {
  const base = GUIDANCE[category] || GUIDANCE.other;
  const extras: string[] = [];
  if (context.setupIncomplete && category !== "repo_wont_run") {
    extras.push(
      "Your setup checklist is still incomplete — resolve environment issues before debugging product behavior."
    );
  }
  extras.push(
    `Context: ${context.repoFullName} — "${context.issueTitle}" (stage: ${context.currentStage}).`
  );
  extras.push(
    "This assistant will not generate a full patch. Use it to unblock investigation, then implement the change yourself."
  );
  return [base, ...extras].join("\n\n");
}
