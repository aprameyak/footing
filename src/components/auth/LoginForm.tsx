"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm({ githubEnabled }: { githubEnabled: boolean }) {
  const [login, setLogin] = useState("devuser");
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-md mx-auto mt-24 px-4">
      <h1 className="text-[20px] font-medium tracking-tight">footing</h1>
      <p className="mt-2 text-[13px] text-[var(--text-muted)] leading-relaxed">
        Find realistic open-source work and get through the hard first steps —
        setup, orientation, and a useful PR — without replacing the engineering.
      </p>

      <div className="mt-8 space-y-3">
        {githubEnabled && (
          <button
            type="button"
            onClick={() => signIn("github", { callbackUrl: "/feed" })}
            className="w-full px-3 py-2.5 text-[13px] border border-[var(--border)] bg-[var(--bg-elevated)]"
          >
            Continue with GitHub
          </button>
        )}

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
            Uses public GitHub API. Set GITHUB_TOKEN for higher rate limits.
            OAuth requests only read:user and user:email.
          </p>
        </div>
      </div>
    </div>
  );
}
