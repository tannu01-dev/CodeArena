
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";
import { apiRequest } from "../../lib/api";

export default function CreateProblemPage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    difficulty: "easy",
    type: "coding",
    tags: "",
    constraints: "",
    points: "10",
    starterCode: "",
    optionsText: "",
    correctOptionId: "",
    expectedAnswer: "",
    testCasesJson: "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest("/profile/me")
      .then((r) => setProfile(r.profile))
      .catch((e) => setError(e.message));
  }, []);

  function change(e) {
    setForm((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const options = form.optionsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text, i) => ({
          id: String.fromCharCode(65 + i),
          text,
        }));

      let testCases = [];

      if (form.type === "coding" && form.testCasesJson.trim()) {
        try {
          testCases = JSON.parse(form.testCasesJson);
        } catch {
          throw new Error(
            "Test cases must be valid JSON. See the example in the test cases field."
          );
        }

        if (
          !Array.isArray(testCases) ||
          testCases.some(
            (tc) =>
              !tc ||
              typeof tc.expectedOutput !== "string" ||
              typeof (tc.input ?? "") !== "string"
          )
        ) {
          throw new Error(
            "Each test case must include string input and expectedOutput fields."
          );
        }
      }

      const result = await apiRequest("/problems", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          difficulty: form.difficulty,
          type: form.type,
          tags: form.tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          constraints: form.constraints,
          points: Number(form.points),
          starterCode: form.starterCode,
          options,
          correctOptionId: form.correctOptionId.toUpperCase(),
          expectedAnswer: form.expectedAnswer,

          testCases:
            form.type === "coding"
              ? testCases.map((tc) => ({
                  input: tc.input || "",
                  expectedOutput: tc.expectedOutput,
                  hidden: tc.hidden !== false,
                }))
              : [],
        }),
      });

      router.push(`/problems/${result.problem._id}`);
    } catch (e2) {
      setError(e2.message || "Problem could not be created.");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400";

  return (
    <DashboardShell profile={profile}>
      <Link
        href="/problems"
        className="text-sm text-cyan-300 hover:underline"
      >
        ← Problem bank
      </Link>

      <h1 className="mt-4 text-3xl font-black">
        Create a problem
      </h1>

      <p className="mt-2 text-slate-400">
        Add a coding, MCQ, or short-answer problem to the shared bank.
      </p>

      {profile &&
        !["recruiter", "admin"].includes(profile.role) && (
          <p className="mt-5 rounded-xl bg-amber-400/10 p-4 text-amber-200">
            Only recruiters and admins can create problems.
          </p>
        )}

      <form
        onSubmit={submit}
        className="mt-7 space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6"
      >
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-400/10 p-4 text-red-200"
          >
            {error}
          </p>
        )}

        <label className="block text-sm text-slate-300">
          Title *

          <input
            required
            name="title"
            value={form.title}
            onChange={change}
            className={input}
            maxLength={160}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Description *

          <textarea
            required
            name="description"
            value={form.description}
            onChange={change}
            className={input}
            rows={6}
            maxLength={12000}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="text-sm text-slate-300">
            Difficulty

            <select
              name="difficulty"
              value={form.difficulty}
              onChange={change}
              className={input}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Question type

            <select
              name="type"
              value={form.type}
              onChange={change}
              className={input}
            >
              <option value="coding">Coding</option>
              <option value="mcq">MCQ</option>
              <option value="short_answer">Short answer</option>
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Points

            <input
              type="number"
              min="1"
              max="1000"
              name="points"
              value={form.points}
              onChange={change}
              className={input}
            />
          </label>
        </div>

        <label className="block text-sm text-slate-300">
          Tags (comma-separated)

          <input
            name="tags"
            value={form.tags}
            onChange={change}
            className={input}
            placeholder="arrays, strings, javascript"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Constraints

          <textarea
            name="constraints"
            value={form.constraints}
            onChange={change}
            className={input}
            rows={2}
          />
        </label>

        {form.type === "coding" && (
          <>
            <label className="block text-sm text-slate-300">
              Starter code

              <textarea
                name="starterCode"
                value={form.starterCode}
                onChange={change}
                className={`${input} font-mono`}
                rows={5}
              />
            </label>

            <label className="block text-sm text-slate-300">
              Test cases (JSON) — required for automatic coding evaluation

              <textarea
                name="testCasesJson"
                value={form.testCasesJson}
                onChange={change}
                className={`${input} font-mono text-sm`}
                rows={7}
                spellCheck={false}
                placeholder={`[
  {"input":"2 3", "expectedOutput":"5", "hidden":false},
  {"input":"10 20", "expectedOutput":"30", "hidden":true}
]`}
              />

              <span className="mt-2 block text-xs leading-5 text-slate-400">
                Every test needs <code>input</code> and{" "}
                <code>expectedOutput</code>. Set{" "}
                <code>hidden: false</code> for visible sample tests;
                hidden tests are used only for final scoring. The
                example is only a format guide—replace it with tests
                that match your question. If you leave this empty,
                coding responses will remain pending for recruiter
                review.
              </span>
            </label>
          </>
        )}

        {form.type === "mcq" && (
          <>
            <label className="block text-sm text-slate-300">
              Options (one option per line)

              <textarea
                name="optionsText"
                value={form.optionsText}
                onChange={change}
                className={input}
                rows={4}
                placeholder={"First option\nSecond option\nThird option"}
              />
            </label>

            <label className="block text-sm text-slate-300">
              Correct option ID (A, B, C...)

              <input
                name="correctOptionId"
                value={form.correctOptionId}
                onChange={change}
                className={input}
                maxLength={1}
              />
            </label>
          </>
        )}

        {form.type === "short_answer" && (
          <label className="block text-sm text-slate-300">
            Expected answer (exact match, case-insensitive)

            <input
              name="expectedAnswer"
              value={form.expectedAnswer}
              onChange={change}
              className={input}
            />
          </label>
        )}

        <button
          disabled={saving}
          className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create problem"}
        </button>
      </form>
    </DashboardShell>
  );
}
