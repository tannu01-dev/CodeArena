
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";
import { apiRequest } from "../../lib/api";

export default function ManageAssessmentsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [problems, setProblems] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    durationMinutes: "30",
    problemIds: [],
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [p, a, b] = await Promise.all([
      apiRequest("/profile/me"),
      apiRequest("/assessments"),
      apiRequest("/problems?limit=50"),
    ]);

    setProfile(p.profile);
    setAssessments(a.assessments || []);
    setProblems(b.problems || []);
  }

  useEffect(() => {
    refresh().catch((e) =>
      setError(e.message || "Could not load management data.")
    );
  }, []);

  function toggleProblem(id) {
    setForm((f) => ({
      ...f,
      problemIds: f.problemIds.includes(id)
        ? f.problemIds.filter((x) => x !== id)
        : [...f.problemIds, id],
    }));
  }

  async function create(e) {
    e.preventDefault();

    setSaving(true);
    setError("");

    try {
      await apiRequest("/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          durationMinutes: Number(form.durationMinutes),
        }),
      });

      setForm({
        title: "",
        description: "",
        instructions: "",
        durationMinutes: "30",
        problemIds: [],
      });

      await refresh();
    } catch (e2) {
      setError(e2.message || "Could not create assessment.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a) {
    try {
      await apiRequest(`/assessments/${a._id}/publish`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      await refresh();
    } catch (e) {
      setError(e.message || "Could not change assessment status.");
    }
  }

  async function archive(a) {
    if (!window.confirm(`Archive "${a.title}"?`)) {
      return;
    }

    try {
      await apiRequest(`/assessments/${a._id}`, {
        method: "DELETE",
      });

      await refresh();
    } catch (e) {
      setError(e.message || "Could not archive assessment.");
    }
  }

  const input =
    "mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400";

  return (
    <DashboardShell profile={profile}>
      <Link
        href="/assessments"
        className="text-sm text-cyan-300 hover:underline"
      >
        ← Assessments
      </Link>

      <h1 className="mt-4 text-3xl font-black">
        Assessment management
      </h1>

      <p className="mt-2 text-slate-400">
        Create assessments, choose problem-bank items, and publish
        when ready.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-400/10 p-4 text-red-200"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={create}
        className="mt-7 space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6"
      >
        <h2 className="text-xl font-bold">
          Create assessment
        </h2>

        <label className="block text-sm text-slate-300">
          Title *
          <input
            required
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
            className={input}
            maxLength={180}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Description
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className={input}
            rows={3}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Instructions
          <textarea
            value={form.instructions}
            onChange={(e) =>
              setForm({ ...form, instructions: e.target.value })
            }
            className={input}
            rows={3}
          />
        </label>

        <label className="block max-w-xs text-sm text-slate-300">
          Duration (minutes)
          <input
            type="number"
            min="1"
            max="600"
            value={form.durationMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                durationMinutes: e.target.value,
              })
            }
            className={input}
          />
        </label>

        <div>
          <h3 className="font-semibold">
            Choose problems ({form.problemIds.length} selected)
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Create problems first under Problem Bank. Select at
            least one item.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {problems.map((p) => (
              <label
                key={p._id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-slate-900 p-4"
              >
                <input
                  type="checkbox"
                  checked={form.problemIds.includes(p._id)}
                  onChange={() => toggleProblem(p._id)}
                  className="mt-1"
                />

                <span>
                  <span className="block font-medium">
                    {p.title}
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    {p.difficulty} · {p.type} · {p.points} points
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          disabled={saving || !form.problemIds.length}
          className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create draft"}
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-xl font-bold">
          Your assessments
        </h2>

        <div className="mt-4 space-y-3">
          {assessments.map((a) => (
            <article
              key={a._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div>
                <h3 className="font-bold">{a.title}</h3>

                <p className="mt-1 text-sm text-slate-400">
                  {a.durationMinutes} min ·{" "}
                  {a.problems?.length ??
                    a.problemIds?.length ??
                    0}{" "}
                  questions · {a.status}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => togglePublish(a)}
                  className="rounded-lg border border-cyan-400/30 px-4 py-2 text-sm text-cyan-300"
                >
                  {a.status === "published"
                    ? "Unpublish"
                    : "Publish"}
                </button>

                <button
                  onClick={() => archive(a)}
                  className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300"
                >
                  Archive
                </button>
              </div>
            </article>
          ))}

          {!assessments.length && (
            <p className="text-slate-500">
              No assessments created yet.
            </p>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
