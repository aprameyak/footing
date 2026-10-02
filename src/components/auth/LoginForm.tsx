"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm({
  githubEnabled,
  devLoginEnabled,
}: {
  githubEnabled: boolean;
  devLoginEnabled: boolean;
}) {
  const [login, setLogin] = useState("devuser");
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-md mx-auto mt-24 px-4">
      <h1 className="text-[20px] font-medium tracking-tight">footing</h1>
      <p className="mt-2 text-[13px] text-[var(--text-muted)] leading-relaxed">
        Find realistic open-source work and get through setup, investigation,
        and a useful PR.
      </p>

      <div className="mt-8 space-y-3">
        {githubEnabled && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/feed" })}
              className="w-full px-3 py-2.5 text-[13px] border border-[var(--border)] bg-[var(--bg-elevated)]"
            >
              Continue with GitHub
            </button>
            <p className="text-[11px] text-[var(--text-faint)]">
              OAuth scope: read:user, user:email
            </p>
          </div>
        )}

        {devLoginEnabled && (
          <div className="panel p-4">
            <div className="text-[12px] text-[var(--text-faint)] mb-2">
              Local / demo sign-in
            </div>
            <div className="flex gap-2">
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-2 py-1.5 text-[12px] mono outline-none"
                placeholder="username"
              />
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  await signIn("dev-login", {
                    login,
                    callbackUrl: "/feed",
                  });
                  setLoading(false);
                }}
                className="px-3 py-1.5 text-[12px] border border-[var(--border)]"
              >
                {loading ? "…" : "Enter"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-faint)]">
              Analysis uses the public GitHub API. Set GITHUB_TOKEN for higher
              rate limits.
            </p>
          </div>
        )}

        {!githubEnabled && !devLoginEnabled && (
          <p className="text-[13px] text-[var(--negative)] leading-relaxed">
            No sign-in methods configured. Set GITHUB_CLIENT_ID and
            GITHUB_CLIENT_SECRET, or enable ENABLE_DEV_LOGIN in development.
          </p>
        )}
      </div>
    </div>
  );
}
