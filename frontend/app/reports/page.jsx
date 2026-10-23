
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getCandidateReports,
  getRecruiterAnalytics,
  getRecruiterSubmissions,
  queueSubmissionEvaluation,
  downloadResultsCsv,
} from "../lib/phase11to14";

const statusLabel = (status) =>
  ({
    graded: "Evaluated",
    pending: "Pending review",
    running: "Evaluating",
    failed: "Evaluation failed",
  }[status] || status || "Pending review");

export default function ReportsPage() {
  const [mode, setMode] = useState("candidate");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [evaluating, setEvaluating] = useState("");
  const [notice, setNotice] = useState("");

  async function load(nextMode = mode) {
    setError("");
    setNotice("");

    try {
      const result =
        nextMode === "candidate"
          ? await getCandidateReports()
          : nextMode === "recruiter"
            ? await getRecruiterAnalytics()
            : await getRecruiterSubmissions();

      setData(result);
    } catch (e) {
      setError(e.message || "Could not load reports.");
    }
  }

  useEffect(() => {
    load(mode);
  }, [mode]);

  useEffect(() => {
    const isEvaluating =
      mode === "candidate"
        ? (data?.reports || []).some((r) =>
            (r.answers || []).some(
              (a) => a.evaluationStatus === "running"
            )
          )
        : mode === "submissions"
          ? (data?.submissions || []).some((s) =>
              (s.answers || []).some(
                (a) => a.evaluationStatus === "running"
              )
            )
          : false;

    if (!isEvaluating) return;

    const timer = setInterval(() => load(mode), 3500);

    return () => clearInterval(timer);
  }, [data, mode]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            Results & candidate responses
          </h1>

          <p className="mt-1 text-gray-600">
            Submitted answers, code, evaluation status and scores saved
            by CodeArena.
          </p>
        </div>

        <Link className="underline" href="/assessments">
          Assessments
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded border px-4 py-2 ${
            mode === "candidate" ? "bg-black text-white" : ""
          }`}
          onClick={() => setMode("candidate")}
        >
          My reports
        </button>

        <button
          className={`rounded border px-4 py-2 ${
            mode === "recruiter" ? "bg-black text-white" : ""
          }`}
          onClick={() => setMode("recruiter")}
        >
          Recruiter analytics
        </button>

        <button
          className={`rounded border px-4 py-2 ${
            mode === "submissions" ? "bg-black text-white" : ""
          }`}
          onClick={() => setMode("submissions")}
        >
          Candidate responses
        </button>

        {mode !== "candidate" && (
          <>
            <button
              className="rounded border px-4 py-2"
              onClick={() => load(mode)}
            >
              Refresh results
            </button>

            <button
              className="rounded border px-4 py-2"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");

                try {
                  await downloadResultsCsv();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Exporting…" : "Export CSV"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p className="rounded bg-emerald-50 p-3 text-emerald-800">
          {notice}
        </p>
      )}

      {!data && !error && <p>Loading saved results…</p>}

      {data && mode === "candidate" && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">Assessment</th>
                <th className="p-3">Score so far</th>
                <th className="p-3">Percent</th>
                <th className="p-3">Evaluation</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Report</th>
              </tr>
            </thead>

            <tbody>
              {(data.reports || []).map((r) => (
                <tr className="border-b" key={r.attemptId}>
                  <td className="p-3">{r.assessment}</td>

                  <td className="p-3">
                    {r.score} / {r.totalPoints}
                  </td>

                  <td className="p-3">{r.percentage}%</td>

                  <td className="p-3">
                    {r.answers?.some(
                      (a) => a.evaluationStatus === "running"
                    )
                      ? `${
                          r.answers.filter(
                            (a) => a.evaluationStatus === "running"
                          ).length
                        } evaluating`
                      : r.answers?.some(
                            (a) => a.evaluationStatus === "pending"
                          )
                        ? `${
                            r.answers.filter(
                              (a) => a.evaluationStatus === "pending"
                            ).length
                          } pending review`
                        : r.answers?.some(
                              (a) => a.evaluationStatus === "failed"
                            )
                          ? `${
                              r.answers.filter(
                                (a) => a.evaluationStatus === "failed"
                              ).length
                            } failed`
                          : "Evaluated"}
                  </td>

                  <td className="p-3">
                    {r.submittedAt
                      ? new Date(r.submittedAt).toLocaleString()
                      : "—"}
                  </td>

                  <td className="p-3">
                    <Link
                      className="underline"
                      href={`/assessments/results/${r.attemptId}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!data.reports?.length && (
            <p className="p-4">
              No submitted attempts are available for this account yet.
            </p>
          )}
        </div>
      )}

      {data && mode === "recruiter" && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(data.summary || {}).map(([key, value]) => (
              <section className="rounded border p-4" key={key}>
                <p className="text-sm capitalize text-gray-500">
                  {key
                    .replace(/[A-Z]/g, (m) => ` ${m}`)
                    .replace(/([a-z])([A-Z])/g, "$1 $2")}
                </p>

                <p className="text-2xl font-semibold">
                  {value}
                  {key.toLowerCase().includes("rate") ||
                  key.toLowerCase().includes("score")
                    ? "%"
                    : ""}
                </p>
              </section>
            ))}
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-3">Assessment</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Average score</th>
                  <th className="p-3">Pass rate</th>
                  <th className="p-3">Completed</th>
                </tr>
              </thead>

              <tbody>
                {(data.assessments || []).map((a) => (
                  <tr className="border-b" key={a.assessmentId}>
                    <td className="p-3">{a.title}</td>
                    <td className="p-3">{a.attempts}</td>
                    <td className="p-3">{a.averageScore}%</td>
                    <td className="p-3">{a.passRate}%</td>
                    <td className="p-3">{a.completionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!data.assessments?.length && (
              <p className="p-4">
                No assessments created by this recruiter yet.
              </p>
            )}
          </div>

          <p className="text-sm text-gray-600">
            Open “Candidate responses” to see each candidate’s answer and
            code.
          </p>
        </>
      )}

      {data && mode === "submissions" && (
        <section className="space-y-4">
          {(data.submissions || []).map((s) => (
            <article
              className="overflow-hidden rounded-xl border"
              key={s.attemptId}
            >
              <button
                className="flex w-full flex-wrap items-center justify-between gap-3 bg-gray-50 p-4 text-left hover:bg-gray-100"
                onClick={() =>
                  setExpanded(
                    expanded === s.attemptId ? "" : s.attemptId
                  )
                }
              >
                <div>
                  <h2 className="font-semibold">
                    {s.candidate.name}
                    <span className="font-normal text-gray-500">
                      {" "}
                      · {s.candidate.email}
                    </span>
                  </h2>

                  <p className="text-sm text-gray-600">
                    {s.assessmentTitle} · Submitted{" "}
                    {s.submittedAt
                      ? new Date(s.submittedAt).toLocaleString()
                      : "—"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold">
                    {s.score} / {s.totalPoints} ({s.percentage}%)
                  </p>

                  <p className="text-sm text-gray-600">
                    {s.pendingEvaluations
                      ? `${s.pendingEvaluations} pending evaluation(s)`
                      : s.failedEvaluations
                        ? `${s.failedEvaluations} evaluation failure(s)`
                        : "Evaluation complete"}
                    {" · "}
                    {expanded === s.attemptId
                      ? "Hide responses ▲"
                      : "View responses ▼"}
                  </p>
                </div>
              </button>

              {expanded === s.attemptId && (
                <div className="space-y-4 p-4">
                  {(s.answers || []).map((a, i) => (
                    <section
                      className="rounded-lg border p-4"
                      key={`${s.attemptId}-${a.problemId}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Question {i + 1} · {a.questionType}
                          </p>

                          <h3 className="mt-1 font-semibold">
                            {a.questionTitle}
                          </h3>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold">
                            {a.earnedPoints} / {a.maxPoints}
                          </p>

                          <span
                            className={`inline-block rounded px-2 py-1 text-xs ${
                              a.evaluationStatus === "graded"
                                ? "bg-green-100 text-green-800"
                                : a.evaluationStatus === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {statusLabel(a.evaluationStatus)}
                          </span>
                        </div>
                      </div>

                      {a.questionType === "coding" ? (
                        <>
                          <p className="mt-3 text-sm text-gray-600">
                            Language: {a.language || "Not specified"}
                          </p>

                          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-4 text-sm text-slate-100">
                            {a.code || "No code response submitted."}
                          </pre>
                        </>
                      ) : (
                        <div className="mt-3 rounded bg-gray-50 p-3">
                          <p className="mb-1 text-xs uppercase text-gray-500">
                            Candidate response
                          </p>

                          <p className="whitespace-pre-wrap">
                            {a.response || "No response submitted."}
                          </p>
                        </div>
                      )}

                      {a.totalTests > 0 && (
                        <p className="mt-3 text-sm font-medium text-gray-700">
                          Test results: {a.passedTests}/{a.totalTests}{" "}
                          passed · {a.verdict || "Pending"}
                        </p>
                      )}

                      {a.evaluationMessage && (
                        <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
                          {a.evaluationMessage}
                        </p>
                      )}
                    </section>
                  ))}

                  {!s.answers?.length && (
                    <p>No responses were saved for this attempt.</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="inline-block underline"
                      href={`/assessments/results/${s.attemptId}`}
                    >
                      Open full attempt report
                    </Link>

                    {s.answers?.some(
                      (a) =>
                        a.questionType === "coding" &&
                        a.code &&
                        ["pending", "failed"].includes(a.evaluationStatus)
                    ) && (
                      <button
                        disabled={evaluating === s.attemptId}
                        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        onClick={async () => {
                          setEvaluating(s.attemptId);
                          setError("");

                          try {
                            const result =
                              await queueSubmissionEvaluation(
                                s.attemptId
                              );

                            await load("submissions");
                            setExpanded(s.attemptId);

                            setNotice(
                              result.message || "Evaluation queued."
                            );
                          } catch (e) {
                            setError(
                              e.message ||
                                "Could not queue evaluation."
                            );
                          } finally {
                            setEvaluating("");
                          }
                        }}
                      >
                        {evaluating === s.attemptId
                          ? "Queueing…"
                          : "Evaluate / retry coding answers"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}

          {!data.submissions?.length && (
            <div className="rounded border p-6 text-gray-600">
              No candidate submissions for assessments created by this
              recruiter yet.
            </div>
          )}
        </section>
      )}
    </main>
  );
}
