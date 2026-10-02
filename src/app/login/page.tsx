import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/auth/Providers";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/feed");

  return (
    <Providers>
      <LoginForm
        githubEnabled={Boolean(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        )}
      />
    </Providers>
  );
}
