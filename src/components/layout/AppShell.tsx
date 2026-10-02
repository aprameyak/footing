import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

const NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/search", label: "Search" },
  { href: "/saved", label: "Saved" },
  { href: "/contributions", label: "Contributions" },
  { href: "/profile", label: "Profile" },
];

export async function AppShell({
  children,
  context,
}: {
  children: React.ReactNode;
  context?: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[200px_1fr_300px]">
      <aside className="border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-5">
        <Link href="/feed" className="block mb-6 no-underline">
          <div className="text-[15px] font-medium tracking-tight text-[var(--text)]">
            footing
          </div>
          <div className="text-[11px] text-[var(--text-faint)] mt-0.5">
            open-source contribution guide
          </div>
        </Link>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2 py-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] rounded-sm no-underline whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 pt-4 divider text-[12px] text-[var(--text-faint)]">
          {session?.user?.login ? (
            <div className="flex flex-col gap-2">
              <span className="mono text-[var(--text-muted)]">
                @{session.user.login}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text)]"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </div>
      </aside>

      <main className="min-w-0 px-5 py-5 lg:px-8 lg:py-6">{children}</main>

      <aside className="hidden lg:block border-l border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-5">
        {context || (
          <div className="text-[12px] text-[var(--text-faint)] leading-relaxed">
            Paste a repository or issue from the feed. Recommendations explain
            why they appear. Analysis separates repository facts from inference.
          </div>
        )}
      </aside>
    </div>
  );
}
