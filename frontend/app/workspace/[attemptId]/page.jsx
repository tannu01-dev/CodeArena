
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codeArenaApi } from "../../lib/codearena";
import AntiCheatMonitor from "../../components/AntiCheatMonitor";
import RealtimeAttemptSync from "../../components/RealtimeAttemptSync";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center bg-slate-950 text-slate-400">
        Loading code editor…
      </div>
    ),
  }
);

const LANGUAGE_OPTIONS = [
  {
    value: "javascript",
    label: "JavaScript (Node.js)",
    monaco: "javascript",
  },
  {
    value: "python",
    label: "Python 3",
    monaco: "python",
  },
  {
    value: "java",
    label: "Java",
    monaco: "java",
  },
  {
    value: "cpp",
    label: "C++",
    monaco: "cpp",
  },
  {
    value: "c",
    label: "C",
    monaco: "c",
  },
  {
    value: "csharp",
    label: "C#",
    monaco: "csharp",
  },
  {
    value: "php",
    label: "PHP",
    monaco: "php",
  },
  {
    value: "ruby",
    label: "Ruby",
    monaco: "ruby",
  },
  {
    value: "go",
    label: "Go",
    monaco: "go",
  },
  {
    value: "rust",
    label: "Rust",
    monaco: "rust",
  },
  {
    value: "typescript",
    label: "TypeScript",
    monaco: "typescript",
  },
];

function formatTime(seconds) {
  const s = Math.max(0, seconds);

  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
    s % 60
  ).padStart(2, "0")}`;
}

export default function CodingWorkspacePage() {
  const { attemptId } = useParams();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState("Loading workspace…");
  const [error, setError] = useState("");
  const [job, setJob] = useState(null);
  const [warning, setWarning] = useState("");
  const [terminated, setTerminated] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const saveTimer = useRef(null);
  const latest = useRef({
    code,
    language,
    answer,
    selected,
  });

  const problems = data?.problems || [];
  const problem = problems[selected];

  useEffect(() => {
    latest.current = {
      code,
      language,
      answer,
      selected,
    };
  }, [code, language, answer, selected]);

  const load = useCallback(async () => {
    try {
      const result = await codeArenaApi.getWorkspace(attemptId);

      setData(result.workspace);

      if (result.workspace.attempt.status !== "in_progress") {
        setTerminated(true);
        setSaveState("Attempt ended");
      }

      const first = result.workspace.problems?.[0];

      if (first) {
        setCode(first.draft || first.starterCode || "");
        setLanguage(first.language || "javascript");
        setAnswer(first.answer || "");
      }

      setSaveState("Draft restored");
    } catch (e) {
      setError(e.message || "Unable to load workspace.");
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (
      !data?.attempt?.deadlineAt ||
      data.attempt.status !== "in_progress"
    ) {
      return;
    }

    const tick = () => {
      const sec = Math.ceil(
        (new Date(data.attempt.deadlineAt).getTime() - Date.now()) /
          1000
      );

      setRemaining(Math.max(0, sec));

      if (sec <= 0) {
        setWarning("Time is over. Finalizing your assessment…");
      }
    };

    tick();

    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [data?.attempt?.deadlineAt, data?.attempt?.status]);

  useEffect(() => {
    if (!problem) return;

    setCode(problem.draft || problem.starterCode || "");
    setLanguage(problem.language || "javascript");
    setAnswer(problem.answer || "");
    setJob(null);
  }, [problem?._id]);

  const save = useCallback(
    async (quiet = false) => {
      if (
        !problem ||
        terminated ||
        data?.attempt?.status !== "in_progress"
      ) {
        return;
      }

      try {
        if (!quiet) {
          setSaveState("Saving…");
        }

        await codeArenaApi.saveDraft(attemptId, {
          problemId: problem._id,
          code: latest.current.code,
          language: latest.current.language,
          answer: latest.current.answer,
        });

        setSaveState("Saved just now");

        return true;
      } catch (e) {
        setSaveState(`Save failed: ${e.message}`);

        return false;
      }
    },
    [attemptId, problem, terminated, data?.attempt?.status]
  );

  useEffect(() => {
    if (!problem || terminated) return;

    clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => save(true), 700);

    return () => clearTimeout(saveTimer.current);
  }, [code, language, answer, problem, save, terminated]);

  const languageMeta = useMemo(
    () =>
      LANGUAGE_OPTIONS.find((l) => l.value === language) ||
      LANGUAGE_OPTIONS[0],
    [language]
  );

  const runCode = async (mode) => {
    if (!problem || busy || terminated) return;

    setBusy(true);
    setError("");

    setJob({
      status: "queued",
      verdict:
        mode === "run" ? "Queueing run…" : "Queueing submission…",
      results: [],
    });

    try {
      const saved = await save(true);

      if (!saved) {
        throw new Error(
          "Draft could not be saved. Check your connection and try again before running code."
        );
      }

      const created = await codeArenaApi.createJob({
        attemptId,
        problemId: problem._id,
        language,
        sourceCode: code,
        mode,
        idempotencyKey: `${attemptId}-${problem._id}-${mode}-${Date.now()}`,
      });

      let current = created.job;

      for (
        let i = 0;
        i < 45 && ["queued", "running"].includes(current.status);
        i++
      ) {
        setJob(current);

        await new Promise((r) => setTimeout(r, 1000));

        const status = await codeArenaApi.getJob(current._id);

        current = status.job;
      }

      setJob(current);

      if (["queued", "running"].includes(current.status)) {
        setError(
          "Execution is still processing. You can continue editing; check the job again by pressing Run/Submit after the current request finishes."
        );
      }
    } catch (e) {
      setError(e.message || "Could not queue code execution.");

      setJob({
        status: "failed",
        verdict: "Request failed",
        errorMessage: e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setConfirmSubmit(false);
    setBusy(true);
    setError("");

    try {
      const saved = await save(true);

      if (!saved) {
        throw new Error(
          "Your latest code could not be saved. Please retry after the save succeeds."
        );
      }

      const result = await codeArenaApi.submitAttempt(
        attemptId,
        `${attemptId}-${Date.now()}`
      );

      setTerminated(true);

      router.replace(`/assessments/results/${attemptId}`);
    } catch (e) {
      setError(e.message || "Unable to submit assessment.");
      setBusy(false);
    }
  };

  const onTerminated = useCallback((message) => {
    setTerminated(true);
    setWarning(message);
  }, []);

  const onWarning = useCallback((message) => {
    setWarning(message);
  }, []);

  if (error && !data) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-500/30 bg-slate-900 p-6">
          <h1 className="text-xl font-bold">
            Workspace unavailable
          </h1>

          <p className="mt-3 text-rose-200">{error}</p>

          <Link
            href="/assessments"
            className="mt-5 inline-block text-cyan-300"
          >
            Back to assessments
          </Link>
        </div>
      </main>
    );
  }

  if (!data || !problem) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Loading CodeArena workspace…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AntiCheatMonitor
        attemptId={attemptId}
        enabled={
          !terminated && data.attempt.status === "in_progress"
        }
        onWarning={onWarning}
        onTerminated={onTerminated}
      />

      <RealtimeAttemptSync attemptId={attemptId} />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href="/assessments"
              className="text-sm text-slate-400 hover:text-white"
            >
              ← Assessments
            </Link>

            <h1 className="mt-1 font-bold">
              {data.assessment.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">
              {saveState}
            </span>

            <div
              className={`rounded-xl border px-4 py-2 font-mono text-lg font-bold ${
                remaining < 300
                  ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
                  : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
              }`}
            >
              {formatTime(remaining)}
            </div>

            <button
              onClick={() => setConfirmSubmit(true)}
              disabled={terminated || busy}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
            >
              Submit assessment
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(500px,1.18fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 p-3">
            {problems.map((p, i) => (
              <button
                key={p._id}
                onClick={() => setSelected(i)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  selected === i
                    ? "bg-cyan-300 font-bold text-slate-950"
                    : "bg-white/5 text-slate-300"
                }`}
              >
                Q{i + 1}
              </button>
            ))}
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                {problem.difficulty}
              </span>

              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                {problem.points} points
              </span>

              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">
                {problem.type}
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-bold">
              {problem.title}
            </h2>

            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-300">
              {problem.description}
            </p>

            {problem.constraints && (
              <div className="mt-5">
                <h3 className="font-semibold">Constraints</h3>

                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                  {problem.constraints}
                </p>
              </div>
            )}

            {problem.examples?.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold">Examples</h3>

                {problem.examples.map((ex, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-slate-950 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs uppercase text-slate-500">
                          Input
                        </div>

                        <pre className="whitespace-pre-wrap text-sm text-slate-200">
                          {ex.input || "(empty)"}
                        </pre>
                      </div>

                      <div>
                        <div className="mb-1 text-xs uppercase text-slate-500">
                          Output
                        </div>

                        <pre className="whitespace-pre-wrap text-sm text-cyan-200">
                          {ex.output}
                        </pre>
                      </div>
                    </div>

                    {ex.explanation && (
                      <p className="mt-3 text-sm text-slate-400">
                        {ex.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {problem.type === "mcq" && (
              <div className="mt-5 space-y-2">
                {problem.options?.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3"
                  >
                    <input
                      type="radio"
                      name={problem._id}
                      checked={answer === o.id}
                      onChange={() => setAnswer(o.id)}
                    />

                    <span>{o.text}</span>
                  </label>
                ))}
              </div>
            )}

            {problem.type === "short_answer" && (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-5 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white outline-none focus:border-cyan-300"
                placeholder="Type your answer…"
              />
            )}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3">
            <div>
              <h2 className="font-semibold">Code editor</h2>

              <p className="text-xs text-slate-400">
                Drafts autosave to the server
              </p>
            </div>

            <label className="flex min-w-[230px] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              <span>Programming language</span>

              <select
                aria-label="Programming language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full cursor-pointer rounded-xl border-2 border-cyan-300/70 bg-slate-950 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-300/30"
                style={{ colorScheme: "dark" }}
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {problem.type === "coding" ? (
            <MonacoEditor
              height="min(58vh, 620px)"
              language={languageMeta.monaco}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: "on",
                readOnly: terminated,
              }}
            />
          ) : (
            <div className="flex h-56 items-center justify-center p-8 text-center text-slate-400">
              This question is answered in the problem panel. Use Save
              draft to preserve your response.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3">
            <button
              onClick={() => save(false)}
              disabled={terminated || busy}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-40"
            >
              Save draft
            </button>

            {problem.type === "coding" && (
              <>
                <button
                  onClick={() => runCode("run")}
                  disabled={terminated || busy}
                  className="rounded-xl border border-cyan-300/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-40"
                >
                  {busy ? "Processing…" : "▶ Run samples"}
                </button>

                <button
                  onClick={() => runCode("submit")}
                  disabled={terminated || busy}
                  className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40"
                >
                  Submit solution
                </button>
              </>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Execution output</h3>

              {job && (
                <span className="text-xs text-slate-400">
                  {job.status}
                </span>
              )}
            </div>

            {job ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span
                    className={`font-semibold ${
                      job.verdict === "Accepted"
                        ? "text-emerald-300"
                        : job.status === "failed"
                          ? "text-rose-300"
                          : "text-amber-200"
                    }`}
                  >
                    {job.verdict}
                  </span>

                  {job.total > 0 && (
                    <span className="text-sm text-slate-400">
                      {job.passed}/{job.total} tests passed ·{" "}
                      {job.score || 0}%
                    </span>
                  )}
                </div>

                {job.errorMessage && (
                  <p className="mt-2 text-sm text-rose-300">
                    {job.errorMessage}
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {job.results?.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-slate-950 p-3 text-sm"
                    >
                      <div className="flex justify-between">
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
                          {r.stdout}
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
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Run sample tests to see output here. Hidden tests are
                only evaluated when you submit a solution.
              </p>
            )}
          </div>
        </section>
      </div>

      {warning && (
        <div className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-3xl rounded-2xl border border-amber-300/30 bg-amber-950 p-4 text-sm text-amber-100 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <span>{warning}</span>

            <button
              onClick={() => setWarning("")}
              className="font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {terminated && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-lg rounded-3xl border border-rose-400/30 bg-slate-900 p-8">
            <h2 className="text-2xl font-bold">
              Assessment ended
            </h2>

            <p className="mt-3 text-slate-300">
              {warning ||
                (data.attempt.endedReason === "time_expired"
                  ? "The assessment timer expired."
                  : "This attempt is no longer active.")}
            </p>

            <Link
              href={`/assessments/results/${attemptId}`}
              className="mt-6 inline-block rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950"
            >
              View result
            </Link>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">
              Submit assessment?
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              You cannot edit answers after submission. Save your drafts
              before continuing.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmSubmit(false)}
                className="rounded-xl border border-white/15 px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={submit}
                disabled={busy}
                className="rounded-xl bg-cyan-300 px-4 py-2 font-bold text-slate-950"
              >
                Confirm submit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
