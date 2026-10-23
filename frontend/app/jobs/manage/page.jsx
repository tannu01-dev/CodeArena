
"use client";

import { useEffect, useState } from "react";
import {
  listJobs,
  createJob,
  updateJob,
} from "../../lib/phase11to14";

const initial = {
  title: "",
  company: "",
  description: "",
  skills: "",
  requirements: "",
  location: "Remote",
  employmentType: "full-time",
  status: "draft",
  assessmentId: "",
};

export default function ManageJobsPage() {
  const [form, setForm] = useState(initial);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm((o) => ({ ...o, [k]: v }));
  };

  async function load() {
    try {
      const r = await listJobs(true);
      setJobs(r.jobs || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(job, status) {
    setError("");

    try {
      await updateJob(job._id, { status });
      setMessage(`Job status changed to ${status}.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submit(e) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await createJob({
        ...form,
        skills: form.skills
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        requirements: form.requirements
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        assessmentId: form.assessmentId || null,
      });

      setForm(initial);
      setMessage("Job saved to database.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        Job posting management
      </h1>

      <p className="text-gray-600">
        Create a saved draft or publish a job listing.
        Recruiter access is required.
      </p>

      {message && (
        <p className="rounded bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={submit}
        className="grid gap-4 rounded border p-5 sm:grid-cols-2"
      >
        <label>
          Job title
          <input
            required
            className="mt-1 w-full rounded border p-2"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>

        <label>
          Company
          <input
            required
            className="mt-1 w-full rounded border p-2"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </label>

        <label>
          Location
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>

        <label>
          Employment type
          <select
            className="mt-1 w-full rounded border p-2"
            value={form.employmentType}
            onChange={(e) =>
              set("employmentType", e.target.value)
            }
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </label>

        <label className="sm:col-span-2">
          Description
          <textarea
            required
            rows={5}
            className="mt-1 w-full rounded border p-2"
            value={form.description}
            onChange={(e) =>
              set("description", e.target.value)
            }
          />
        </label>

        <label>
          Skills (comma-separated)
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.skills}
            onChange={(e) => set("skills", e.target.value)}
          />
        </label>

        <label>
          Assessment ID (optional)
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.assessmentId}
            onChange={(e) =>
              set("assessmentId", e.target.value)
            }
          />
        </label>

        <label className="sm:col-span-2">
          Requirements (one per line)
          <textarea
            rows={3}
            className="mt-1 w-full rounded border p-2"
            value={form.requirements}
            onChange={(e) =>
              set("requirements", e.target.value)
            }
          />
        </label>

        <label>
          Status
          <select
            className="mt-1 block rounded border p-2"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="draft">Save draft</option>
            <option value="published">Publish now</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-white"
          >
            {saving ? "Saving…" : "Save job"}
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-xl font-semibold">
          Your job postings
        </h2>

        <div className="space-y-2">
          {jobs.map((j) => (
            <article
              key={j._id}
              className="flex flex-wrap justify-between gap-3 rounded border p-3"
            >
              <div>
                <b>{j.title}</b>
                <p className="text-sm text-gray-600">
                  {j.company} · {j.location}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-3 py-1">
                  {j.status}
                </span>

                {j.status !== "published" &&
                  j.status !== "closed" && (
                    <button
                      className="rounded border px-3 py-1"
                      onClick={() =>
                        changeStatus(j, "published")
                      }
                    >
                      Publish
                    </button>
                  )}

                {j.status === "published" && (
                  <button
                    className="rounded border px-3 py-1"
                    onClick={() => changeStatus(j, "closed")}
                  >
                    Close
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        {!jobs.length && (
          <p>No jobs created by this account.</p>
        )}
      </section>
    </main>
  );
}
