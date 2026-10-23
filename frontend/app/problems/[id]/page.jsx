
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";
import { apiRequest } from "../../lib/api";

export default function ProblemDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [problem, setProblem] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [testCasesJson, setTestCasesJson] = useState("");
  const [savingTests, setSavingTests] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiRequest(`/problems/${id}`),
      apiRequest("/profile/me"),
    ])
      .then(([p, u]) => {
        setProblem(p.problem);
        setProfile(u.profile);

        setTestCasesJson(
          Array.isArray(p.problem.testCases)
            ? JSON.stringify(p.problem.testCases, null, 2)
            : ""
        );
      })
      .catch((e) =>
        setError(e.message || "Could not load problem.")
      );
  }, [id]);

  async function saveTestCases() {
    setSavingTests(true);
    setError("");
    setTestMessage("");

    try {
      const parsed = JSON.parse(testCasesJson || "[]");

      if (
        !Array.isArray(parsed) ||
        parsed.some(
          (tc) =>
            !tc ||
            typeof tc.expectedOutput !== "string" ||
            typeof (tc.input ?? "") !== "string"
        )
      ) {
        throw new Error(
          "Each test case needs string input and expectedOutput fields."
        );
      }

      const result = await apiRequest(`/problems/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          testCases: parsed.map((tc) => ({
            input: tc.input || "",
            expectedOutput: tc.expectedOutput,
            hidden: tc.hidden !== false,
          })),
        }),
      });

      setProblem((old) => ({
        ...old,
        testCaseCount:
          result.problem?.testCaseCount ?? parsed.length,
        testCases: parsed,
      }));

      setTestMessage(
        `Saved ${parsed.length} test case(s). New submissions can now be evaluated automatically.`
      );
    } catch (e) {
      setError(
        e.message ||
          "Could not save test cases. Ensure the JSON is valid."
      );
    } finally {
      setSavingTests(false);
    }
  }

  const canEditTests =
    problem &&
    profile &&
    (String(problem.createdBy) ===
      String(profile._id || profile.id) ||
      profile.role === "admin");

  return (
    <DashboardShell profile={profile}>
      <Link
        href="/problems"
        className="text-sm text-cyan-300 hover:underline"
      >
        ← Back to problem bank
      </Link>

      {error && (
        <p className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-200">
          {error}
        </p>
      )}

      {!problem && !error ? (
        <p className="mt-8 text-slate-400">
          Loading problem...
        </p>
      ) : (
        problem && (
          <article className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-300">
                {problem.type}
              </span>

              <span className="rounded-full bg-white/5 px-3 py-1 text-sm capitalize text-slate-300">
                {problem.difficulty}
              </span>

              <span className="text-sm text-slate-500">
                {problem.points} points
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-black sm:text-4xl">
              {problem.title}
            </h1>

            <div className="mt-6 whitespace-pre-wrap leading-7 text-slate-300">
              {problem.description}
            </div>

            {problem.constraints && (
              <section className="mt-7">
                <h2 className="font-bold">Constraints</h2>

                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-900 p-4 text-sm text-slate-300">
                  {problem.constraints}
                </pre>
              </section>
            )}

            {problem.examples?.map((ex, i) => (
              <section key={i} className="mt-7">
                <h2 className="font-bold">
                  Example {i + 1}
                </h2>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-900 p-4">
                    <p className="text-xs uppercase text-slate-500">
                      Input
                    </p>

                    <pre className="mt-2 whitespace-pre-wrap text-sm">
                      {ex.input || "(empty)"}
                    </pre>
                  </div>

                  <div className="rounded-xl bg-slate-900 p-4">
                    <p className="text-xs uppercase text-slate-500">
                      Output
                    </p>

                    <pre className="mt-2 whitespace-pre-wrap text-sm">
                      {ex.output}
                    </pre>
                  </div>
                </div>

                {ex.explanation && (
                  <p className="mt-3 text-sm text-slate-400">
                    {ex.explanation}
                  </p>
                )}
              </section>
            ))}

            {problem.type === "mcq" && (
              <section className="mt-8">
                <h2 className="font-bold">Options</h2>

                <div className="mt-3 grid gap-3">
                  {problem.options?.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-white/10 bg-slate-900 p-4"
                    >
                      {o.id}. {o.text}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {problem.starterCode && (
              <section className="mt-8">
                <h2 className="font-bold">Starter code</h2>

                <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-4 text-sm text-cyan-100">
                  {problem.starterCode}
                </pre>
              </section>
            )}

            {problem.type === "coding" && (
              <section className="mt-8 border-t border-white/10 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">
                      Evaluation test cases
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      Configured: {problem.testCaseCount || 0}.
                      Hidden expected outputs are never shown to
                      candidates.
                    </p>
                  </div>
                </div>

                {canEditTests && (
                  <>
                    <label className="mt-4 block text-sm text-slate-300">
                      Test cases JSON

                      <textarea
                        value={testCasesJson}
                        onChange={(e) =>
                          setTestCasesJson(e.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3 font-mono text-sm text-white"
                        rows={8}
                        spellCheck={false}
                        placeholder={`[
  {"input":"2 3", "expectedOutput":"5", "hidden":false},
  {"input":"10 20", "expectedOutput":"30", "hidden":true}
]`}
                      />
                    </label>

                    <p className="mt-2 text-xs text-slate-400">
                      Add test cases that match this problem’s
                      actual requirements. Set hidden:false for
                      public samples; hidden:true for final
                      scoring tests. An empty array clears test
                      cases.
                    </p>

                    <button
                      onClick={saveTestCases}
                      disabled={savingTests}
                      className="mt-3 rounded-xl bg-cyan-400 px-5 py-2 font-bold text-slate-950 disabled:opacity-50"
                    >
                      {savingTests
                        ? "Saving test cases…"
                        : "Save test cases"}
                    </button>

                    {testMessage && (
                      <p className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">
                        {testMessage}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </article>
        )
      )}
    </DashboardShell>
  );
}
