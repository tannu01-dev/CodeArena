
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { apiRequest } from "../lib/api";

export default function AssessmentsPage() {
  const [profile, setProfile] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest("/profile/me"),
      apiRequest("/assessments"),
    ])
      .then(([p, a]) => {
        setProfile(p.profile);
        setAssessments(a.assessments || []);
      })
      .catch((e) => {
        setError(e.message || "Could not load assessments.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <DashboardShell profile={profile}>
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
        Phase 5 &amp; 6
      </p>

      <h1 className="mt-3 text-4xl font-black">
        Assessments
      </h1>

      <p className="mt-3 text-slate-400">
        Published assessments available for your account.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-200"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-slate-400">
          Loading assessments...
        </p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {assessments
            .filter((a) => a.status === "published")
            .map((a) => (
              <article
                key={a._id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold">
                    {a.title}
                  </h2>

                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    Published
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-400">
                  {a.description ||
                    "Assessment prepared by a CodeArena recruiter."}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-400">
                  <span>{a.durationMinutes} minutes</span>
                  <span>·</span>
                  <span>
                    {a.problems?.length ??
                      a.problemIds?.length ??
                      0}{" "}
                    questions
                  </span>
                </div>

                {a.startAt && (
                  <p className="mt-3 text-xs text-slate-500">
                    Starts:{" "}
                    {new Date(a.startAt).toLocaleString()}
                  </p>
                )}

                <Link
                  href={`/assessments/${a._id}`}
                  className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950"
                >
                  Open assessment →
                </Link>
              </article>
            ))}

          {!assessments.some(
            (a) => a.status === "published"
          ) && (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-slate-400 md:col-span-2">
              No published assessments are available yet.
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
