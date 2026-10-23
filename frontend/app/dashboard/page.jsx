
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "../components/DashboardShell";
import { apiRequest } from "../lib/api";

function StatCard({ label, value, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [dashboardResponse, profileResponse] = await Promise.all([
          apiRequest("/dashboard/summary"),
          apiRequest("/profile/me"),
        ]);

        if (!active) return;

        setDashboard(dashboardResponse.dashboard);
        setProfile(profileResponse.profile);
      } catch (err) {
        if (!active) return;

        setError(err.message || "Could not load dashboard.");

        if (
          err.message?.toLowerCase().includes("unauthorized") ||
          err.message?.toLowerCase().includes("token") ||
          err.message?.toLowerCase().includes("login")
        ) {
          router.replace("/login");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading your CodeArena dashboard...
      </div>
    );
  }

  if (error || !dashboard || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-5 text-white">
        <h1 className="text-2xl font-bold">Dashboard unavailable</h1>
        <p className="max-w-lg text-center text-slate-400">
          {error || "We could not load your profile."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950"
        >
          Try again
        </button>
        <Link href="/login" className="text-cyan-300 hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  const stats = dashboard.stats || {};

  return (
    <DashboardShell profile={profile}>
      <section className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
          Your workspace
        </p>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">
              Welcome back, {profile.name}!
            </h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Your CodeArena workspace, profile details, and account overview.
            </p>
          </div>

          <Link
            href="/profile"
            className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300"
          >
            Edit profile
          </Link>
        </div>
      </section>

      {!profile.profileCompleted && (
        <div className="mb-8 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
          <h2 className="font-bold text-amber-200">Complete your profile</h2>
          <p className="mt-2 text-sm text-slate-300">
            Add your bio, professional title, and skills to make your profile
            more useful.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-block text-sm font-semibold text-amber-200 underline"
          >
            Complete profile →
          </Link>
        </div>
      )}

      {profile.role === "candidate" && (
        <>
          <h2 className="mb-4 text-xl font-bold">Candidate overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Skills added"
              value={stats.skillsCount ?? 0}
              description="Skills in your profile"
            />
            <StatCard
              label="Profile status"
              value={profile.profileCompleted ? "Complete" : "Incomplete"}
              description="Keep your profile updated"
            />
            <StatCard
              label="Assessments"
              value={stats.assessmentsCompleted ?? 0}
              description="Assessment tracking will be connected in a later phase"
            />
            <StatCard
              label="Submissions"
              value={stats.submissions ?? 0}
              description="Submission tracking will be connected in a later phase"
            />
          </div>
        </>
      )}

      {profile.role === "recruiter" && (
        <>
          <h2 className="mb-4 text-xl font-bold">Recruiter overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Company"
              value={stats.company || "Not added"}
              description="Your organization"
            />
            <StatCard
              label="Assessments created"
              value={stats.assessmentsCreated ?? 0}
              description="Assessment management comes in a later phase"
            />
            <StatCard
              label="Candidates reviewed"
              value={stats.candidatesReviewed ?? 0}
              description="Candidate review comes in a later phase"
            />
          </div>
        </>
      )}

      {profile.role === "admin" && (
        <>
          <h2 className="mb-4 text-xl font-bold">Platform overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total users"
              value={stats.totalUsers ?? 0}
              description="Registered platform accounts"
            />
            <StatCard
              label="Candidates"
              value={stats.candidates ?? 0}
              description="Accounts with candidate role"
            />
            <StatCard
              label="Recruiters"
              value={stats.recruiters ?? 0}
              description="Accounts with recruiter role"
            />
          </div>
        </>
      )}

      <section className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/10 to-indigo-500/10 p-6 sm:p-8">
        <p className="text-sm font-semibold text-cyan-300">YOUR PROFILE</p>
        <h2 className="mt-2 text-2xl font-bold">
          {profile.title || "Add your professional title"}
        </h2>
        <p className="mt-2 text-slate-400">
          {profile.company || profile.location || "Add your company or location"}
        </p>

        {profile.skills?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        <Link
          href="/profile"
          className="mt-6 inline-block text-sm font-bold text-cyan-300 hover:underline"
        >
          View and edit profile →
        </Link>
      </section>
    </DashboardShell>
  );
}
