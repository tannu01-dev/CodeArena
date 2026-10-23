
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs, applyToJob } from "../lib/phase11to14";

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [cover, setCover] = useState({});

  async function load() {
    try {
      const r = await listJobs();
      setJobs(r.jobs || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function apply(id) {
    setBusy(id);
    setError("");

    try {
      await applyToJob(id, {
        coverLetter: cover[id] || "",
      });

      setError("Application submitted successfully.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Open roles</h1>
          <p className="text-gray-600">
            Published jobs from the CodeArena database.
          </p>
        </div>

        <Link className="underline" href="/jobs/manage">
          Manage jobs
        </Link>
      </header>

      {error && (
        <p className="rounded bg-gray-100 p-3">{error}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {jobs.map((job) => (
          <article
            className="space-y-3 rounded border p-5"
            key={job._id}
          >
            <div>
              <h2 className="text-xl font-semibold">
                {job.title}
              </h2>

              <p className="text-gray-600">
                {job.company} · {job.location} · {job.employmentType}
              </p>
            </div>

            <p className="whitespace-pre-wrap">
              {job.description}
            </p>

            <p className="text-sm">
              <b>Skills:</b>{" "}
              {(job.skills || []).join(", ") || "Not specified"}
            </p>

            <details>
              <summary className="cursor-pointer">
                Write a cover letter
              </summary>

              <textarea
                className="mt-2 w-full rounded border p-2"
                rows={3}
                value={cover[job._id] || ""}
                onChange={(e) =>
                  setCover((o) => ({
                    ...o,
                    [job._id]: e.target.value,
                  }))
                }
              />
            </details>

            <button
              className="rounded bg-black px-4 py-2 text-white"
              disabled={busy === job._id}
              onClick={() => apply(job._id)}
            >
              {busy === job._id ? "Applying…" : "Apply"}
            </button>
          </article>
        ))}
      </div>

      {!jobs.length && (
        <p>No published jobs are available right now.</p>
      )}
    </main>
  );
}
