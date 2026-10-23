
"use client";

import Link from "next/link";

export default function DashboardShell({ profile, children }) {
  const role = profile?.role || "candidate";

  const roleLabel = {
    candidate: "Candidate",
    recruiter: "Recruiter",
    admin: "Administrator",
  }[role] || "Member";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Link href="/dashboard" className="text-2xl font-black tracking-tight">
            Code<span className="text-cyan-400">Arena</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/dashboard"
              className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Dashboard
            </Link>

            <Link
              href="/profile"
              className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              My Profile
            </Link>

            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-cyan-300">
              {roleLabel}
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10">
        {children}
      </main>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-sm text-slate-500">
        CodeArena · Learn, practice, and grow.
      </footer>
    </div>
  );
}
