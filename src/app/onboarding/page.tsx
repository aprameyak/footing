import { AppShell } from "@/components/layout/AppShell";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { requireUser } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const { user } = await requireUser();

  return (
    <AppShell
      context={
        <div className="text-[12px] text-[var(--text-faint)] leading-relaxed">
          Keep this short. Skills and learning goals are separate on purpose —
          recommendations prefer mostly familiar work plus one stretch.
        </div>
      }
    >
      <h1 className="text-[16px] font-medium mb-1">
        {user.onboardedAt ? "Preferences" : "Onboarding"}
      </h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-6">
        Practical preferences only. You can change these later.
      </p>
      <OnboardingForm
        initial={{
          skills: user.skills.map((s) => s.name),
          learningGoals: user.learningGoals.map((g) => g.name),
          interests: user.interests.map((i) => i.name),
          repositories: user.repositoryInterests.map((r) => r.fullName),
          challengePref: user.challengePref,
        }}
      />
    </AppShell>
  );
}
