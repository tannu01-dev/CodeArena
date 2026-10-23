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
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Link href="/dashboard" className="text-2xl font-black">
            Code<span className="text-cyan-400">Arena</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/dashboard">Dashboard</Link>
            <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/problems">Problems</Link>
            <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/assessments">Assessments</Link>
            {(role === "recruiter" || role === "admin") && (
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/assessments/manage">Manage</Link>
            )}
            <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/profile">My Profile</Link>
            <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/reports">Reports</Link>
            {role === "candidate" && <>
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/talent/profile">Talent profile</Link>
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/jobs">Jobs</Link>
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/applications">Applications</Link>
            </>}
            {(role === "recruiter" || role === "admin") && <>
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/jobs/manage">Job postings</Link>
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/talent/search">Find candidates</Link>
              <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/applications/manage">Hiring pipeline</Link>
            </>}
            {role === "admin" && <Link className="rounded-xl px-4 py-2 text-slate-300 hover:bg-white/10" href="/admin">System admin</Link>}
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-cyan-300">{roleLabel}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10">{children}</main>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-sm text-slate-500">
        CodeArena · Learn, practice, and grow.
      </footer>
    </div>
  );
}
