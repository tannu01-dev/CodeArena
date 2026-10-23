
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../../components/DashboardShell";
import { apiRequest } from "../../../lib/api";

const statusText = (status) =>
  ({
    graded: "Evaluated",
    pending: "Pending review",
    running: "Evaluating",
    failed: "Evaluation failed",
    not_configured: "Test cases not configured",
    not_submitted: "No code submitted",
  }[status] ||
  status ||
  "Pending review");

export default function AssessmentResultPage() {
  const params = useParams();
  const attemptId = params?.attemptId;

  const [profile, setProfile] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  const loadResult = useCallback(
    async (includeProfile = false) => {
      if (!attemptId) return;

      try {
        const requests = [
          apiRequest(`/attempts/${attemptId}`),
          apiRequest(`/results/history/${attemptId}`),
        ];

        if (includeProfile) {
          requests.unshift(apiRequest("/profile/me"));
        }

        const values = await Promise.all(requests);

        if (includeProfile) {
          setProfile(values[0].profile);
        }

        const attemptResult = includeProfile ? values[1] : values[0];
        const historyResult = includeProfile ? values[2] : values[1];

        setAttempt(attemptResult.attempt);
        setHistory(historyResult.submissions || []);
        setError("");
      } catch (e) {
        setError(e.message || "Could not load result.");
      }
    },
    [attemptId]
  );

  useEffect(() => {
    loadResult(true);
  }, [loadResult]);

  useEffect(() => {
    // Keep checking pending and running evaluations.
    // Stop polling when every answer reaches a terminal state.
    const needsRefresh = attempt?.answers?.some(
      (a) =>
        a.evaluationStatus === "running" ||
        (a.evaluationStatus === "pending" &&
          /queued|evaluat/i.test(String(a.evaluationMessage || "")))
    );

    if (!needsRefresh) return;

    const timer = setInterval(() => loadResult(false), 2000);

    return () => clearInterval(timer);
  }, [attempt, loadResult]);

  const percent =
    attempt?.totalPoints > 0
      ? Math.round((attempt.score / attempt.totalPoints) * 10000) / 100
      : 0;

  const pendingCount =
    attempt?.answers?.filter((a) =>
      ["pending", "running"].includes(a.evaluationStatus)
    ).length || 0;

  return (
    <DashboardShell profile={profile}>
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
        Assessment result &amp; submission history
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-200"
        >
          {error}
        </p>
      )}

      {!attempt && !error ? (
        <p className="mt-8 text-slate-400">Loading result...</p>
      ) : (
        attempt && (
          <>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-black">
                  {attempt.assessment?.title || "Your result"}
                </h1>

                <p className="mt-2 text-sm text-slate-400">
                  Submitted{" "}
                  {attempt.submittedAt
                    ? new Date(attempt.submittedAt).toLocaleString()
                    : "—"}
                </p>
              </div>

              <button
                onClick={() => loadResult(false)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              >
                Refresh score
              </button>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm text-slate-400">Earned score so far</p>
                <p className="mt-3 text-3xl font-black">
                  {attempt.score} / {attempt.totalPoints}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm text-slate-400">
                  Current score percentage
                </p>
                <p className="mt-3 text-3xl font-black">{percent}%</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm text-slate-400">
                  Awaiting evaluation/review
                </p>
                <p className="mt-3 text-3xl font-black">{pendingCount}</p>
              </div>
            </div>

            {pendingCount > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">
                Your answers are saved. The score above includes currently
                graded answers only. Queued evaluations refresh automatically.
                Questions with no configured test cases need recruiter review
                and will not receive a fabricated score.
              </div>
            )}

            {attempt.answers.some(
              (a) => a.evaluationStatus === "failed"
            ) && (
              <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-rose-100">
                At least one evaluation failed to run. Check the Judge0
                configuration or ask the recruiter to retry evaluation. The
                error is shown below.
              </div>
            )}

            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-xl font-bold">Question results</h2>

              <div className="mt-4 space-y-3">
                {attempt.answers.map((a, i) => (
                  <div
                    key={String(a.problemId)}
                    className="rounded-xl bg-slate-900 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">Question {i + 1}</p>

                        <p className="mt-1 text-sm text-slate-400">
                          {statusText(a.evaluationStatus)}
                          {a.isCorrect === true
                            ? " · Correct"
                            : a.isCorrect === false
                              ? " · Incorrect"
                              : ""}
                        </p>

                        {a.evaluationMessage && (
                          <p className="mt-2 max-w-3xl text-xs text-slate-400">
                            {a.evaluationMessage}
                          </p>
                        )}
                      </div>

                      <p className="font-bold">
                        {a.earnedPoints} / {a.maxPoints}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Submission tracking</h2>

                <span className="text-sm text-slate-400">
                  {history.length} saved record(s)
                </span>
              </div>

              {!history.length ? (
                <p className="mt-4 text-sm text-slate-400">
                  No separate submission history exists for this attempt yet.
                  Older attempts may only have the final saved answer.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((s) => (
                    <article
                      key={s.id}
                      className="rounded-xl border border-white/10 bg-slate-900 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{s.problemTitle}</h3>

                          <p className="mt-1 text-xs text-slate-400">
                            {s.kind === "solution"
                              ? "Code submission"
                              : "Assessment answer"}{" "}
                            · {s.language || s.questionType} ·{" "}
                            {s.submittedAt
                              ? new Date(s.submittedAt).toLocaleString()
                              : "—"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-bold">
                            {s.earnedPoints} / {s.maxPoints}
                          </p>

                          <p
                            className={`text-sm ${
                              s.status === "graded"
                                ? "text-emerald-300"
                                : s.status === "failed"
                                  ? "text-rose-300"
                                  : "text-amber-200"
                            }`}
                          >
                            {statusText(s.status)} · {s.verdict}
                          </p>

                          {s.totalTests > 0 && (
                            <p className="text-xs text-slate-400">
                              {s.passedTests}/{s.totalTests} test cases passed
                            </p>
                          )}
                        </div>
                      </div>

                      {s.code && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-cyan-300">
                            View submitted code
                          </summary>

                          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs">
                            {s.code}
                          </pre>
                        </details>
                      )}

                      {s.evaluationMessage && (
                        <p className="mt-3 text-sm text-slate-400">
                          {s.evaluationMessage}
                        </p>
                      )}

                      {!!s.testResults?.length && (
                        <div className="mt-3 space-y-2">
                          {s.testResults.map((r, i) => (
                            <div
                              key={i}
                              className="rounded-lg bg-slate-950 p-3 text-sm"
                            >
                              <div className="flex justify-between gap-3">
                                <span>Test {i + 1}</span>

                                <span
                                  className={
                                    r.passed
                                      ? "text-emerald-300"
                                      : "text-rose-300"
                                  }
                                >
                                  {r.passed ? "Passed" : r.status}
                                </span>
                              </div>

                              {r.stdout && (
                                <pre className="mt-2 whitespace-pre-wrap text-slate-300">
                                  Output: {r.stdout}
                                </pre>
                              )}

                              {r.stderr && (
                                <pre className="mt-2 whitespace-pre-wrap text-rose-200">
                                  {r.stderr}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <Link
              href="/assessments"
              className="mt-7 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950"
            >
              Back to assessments
            </Link>
          </>
        )
      )}
    </DashboardShell>
  );
}
