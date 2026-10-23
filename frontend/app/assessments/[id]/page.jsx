
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";
import { apiRequest } from "../../lib/api";

export default function TakeAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [profile, setProfile] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    let active = true;

    async function load() {
      try {
        const [p, a] = await Promise.all([
          apiRequest("/profile/me"),
          apiRequest(`/assessments/${id}`),
        ]);

        if (!active) return;

        setProfile(p.profile);
        setAssessment(a.assessment);
      } catch (e) {
        if (active) {
          setError(e.message || "Could not load assessment.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [id]);

  async function start() {
    setError("");

    try {
      const result = await apiRequest(
        `/assessments/${id}/attempts`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      setAttempt(result.attempt);

      const initial = {};

      for (const a of result.attempt.answers || []) {
        initial[String(a.problemId)] = {
          answer: a.answer || "",
          code: a.code || "",
        };
      }

      setAnswers(initial);
    } catch (e) {
      setError(e.message || "Could not start assessment.");
    }
  }

  function setAnswer(problemId, key, value) {
    setAnswers((current) => ({
      ...current,
      [problemId]: {
        ...(current[problemId] || {
          answer: "",
          code: "",
        }),
        [key]: value,
      },
    }));
  }

  async function submit(e) {
    e.preventDefault();

    if (
      !window.confirm(
        "Submit your assessment? You cannot change answers after submission."
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await apiRequest(
        `/attempts/${attempt._id}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            answers: (assessment.problems || []).map((p) => ({
              problemId: p._id,
              answer: answers[p._id]?.answer || "",
              code: answers[p._id]?.code || "",
            })),
          }),
        }
      );

      router.push(
        `/assessments/results/${result.attempt._id}`
      );
    } catch (e2) {
      setError(e2.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading assessment...
      </div>
    );
  }

  return (
    <DashboardShell profile={profile}>
      <Link
        href="/assessments"
        className="text-sm text-cyan-300 hover:underline"
      >
        ← Assessments
      </Link>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-200"
        >
          {error}
        </p>
      )}

      {!assessment ? (
        <p className="mt-8 text-slate-400">
          Assessment could not be loaded.
        </p>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black">
                  {assessment.title}
                </h1>

                <p className="mt-3 text-slate-400">
                  {assessment.description}
                </p>
              </div>

              <span className="h-fit rounded-full bg-cyan-400/10 px-3 py-2 text-cyan-300">
                {assessment.durationMinutes} minutes
              </span>
            </div>

            {assessment.instructions && (
              <div className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-900 p-4 text-sm text-slate-300">
                {assessment.instructions}
              </div>
            )}
          </div>

          {!attempt ? (
            <button
              onClick={start}
              className="mt-6 rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950"
            >
              Start assessment
            </button>
          ) : (
            <form
              onSubmit={submit}
              className="mt-6 space-y-5"
            >
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                Once submitted, answers cannot be changed.
                Coding answers are saved for evaluation but are
                not run by this server.
              </div>

              {(assessment.problems || []).map((p, index) => (
                <section
                  key={p._id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <h2 className="text-xl font-bold">
                      {index + 1}. {p.title}
                    </h2>

                    <span className="text-sm text-slate-400">
                      {p.points} points · {p.type}
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-slate-300">
                    {p.description}
                  </p>

                  {p.examples?.map((ex, i) => (
                    <div
                      key={i}
                      className="mt-3 rounded-xl bg-slate-900 p-3 text-sm"
                    >
                      <p>
                        <span className="text-slate-500">
                          Input:
                        </span>{" "}
                        {ex.input}
                      </p>

                      <p className="mt-1">
                        <span className="text-slate-500">
                          Output:
                        </span>{" "}
                        {ex.output}
                      </p>
                    </div>
                  ))}

                  {p.type === "mcq" ? (
                    <div className="mt-5 space-y-2">
                      {p.options?.map((o) => (
                        <label
                          key={o.id}
                          className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-slate-900 p-4"
                        >
                          <input
                            type="radio"
                            name={`answer-${p._id}`}
                            checked={
                              answers[p._id]?.answer === o.id
                            }
                            onChange={() =>
                              setAnswer(p._id, "answer", o.id)
                            }
                          />

                          <span>
                            {o.id}. {o.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : p.type === "short_answer" ? (
                    <label className="mt-5 block text-sm text-slate-300">
                      Your answer

                      <input
                        value={answers[p._id]?.answer || ""}
                        onChange={(e) =>
                          setAnswer(
                            p._id,
                            "answer",
                            e.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                      />
                    </label>
                  ) : (
                    <label className="mt-5 block text-sm text-slate-300">
                      Your code

                      <textarea
                        value={answers[p._id]?.code || ""}
                        onChange={(e) =>
                          setAnswer(
                            p._id,
                            "code",
                            e.target.value
                          )
                        }
                        rows={10}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-sm text-cyan-100 outline-none focus:border-cyan-400"
                        placeholder={
                          p.starterCode ||
                          "// Write your solution here"
                        }
                      />
                    </label>
                  )}
                </section>
              ))}

              <button
                disabled={submitting}
                className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 disabled:opacity-50"
              >
                {submitting
                  ? "Submitting..."
                  : "Submit assessment"}
              </button>
            </form>
          )}
        </>
      )}
    </DashboardShell>
  );
}
