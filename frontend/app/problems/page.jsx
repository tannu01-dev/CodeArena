"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { apiRequest } from "../lib/api";

export default function ProblemsPage() {
  const [problems, setProblems] = useState([]);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadProblems() {
    setLoading(true);
    setError("");
    try {
      const [p, u] = await Promise.all([
        apiRequest(`/problems?search=${encodeURIComponent(search)}${difficulty ? `&difficulty=${difficulty}` : ""}`),
        apiRequest("/profile/me"),
      ]);
      setProblems(p.problems || []);
      setProfile(u.profile);
    } catch (e) {
      setError(e.message || "Could not load problems.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProblems(); }, []); // Initial load; filters apply on submit.

  return (
    <DashboardShell profile={profile}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Phase 4</p>
          <h1 className="mt-3 text-4xl font-black">Problem Bank</h1>
          <p className="mt-3 text-slate-400">Browse coding, multiple-choice, and short-answer problems.</p>
        </div>
        {(profile?.role === "recruiter" || profile?.role === "admin") && (
          <Link href="/problems/create" className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">+ Create problem</Link>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); loadProblems(); }} className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search problems..." className="min-w-48 flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400" />
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3">
          <option value="">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
        <button className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950">Search</button>
      </form>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-200">{error}</p>}
      {loading ? <p className="mt-8 text-slate-400">Loading problems...</p> : (
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {problems.map((p) => (
            <Link key={p._id} href={`/problems/${p._id}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-cyan-400/40 hover:bg-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{p.title}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.difficulty === "easy" ? "bg-emerald-400/10 text-emerald-300" : p.difficulty === "hard" ? "bg-red-400/10 text-red-300" : "bg-amber-400/10 text-amber-200"}`}>{p.difficulty}</span>
              </div>
              <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-400">{p.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{p.type}</span>
                {(p.tags || []).slice(0, 4).map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{tag}</span>)}
                <span className="ml-auto text-sm text-cyan-300">{p.points} points →</span>
              </div>
            </Link>
          ))}
          {!problems.length && <div className="rounded-2xl border border-dashed border-white/15 p-8 text-slate-400 md:col-span-2">No problems found. Try a different search or create a problem as a recruiter/admin.</div>}
        </div>
      )}
    </DashboardShell>
  );
}
