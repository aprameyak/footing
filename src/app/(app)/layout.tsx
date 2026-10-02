import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  if (!user.onboardedAt) {
    redirect("/onboarding");
  }
  return <AppShell>{children}</AppShell>;
}
