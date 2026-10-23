
"use client";

import { useState } from "react";
import {
  searchCandidates,
  getJobMatches,
} from "../../lib/phase11to14";

export default function CandidateSearchPage() {
  const [q, setQ] = useState("");
  const [skills, setSkills] = useState("");
  const [jobId, setJobId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setMatches([]);

    try {
      const r = await searchCandidates(q, skills);
      setCandidates(r.candidates || []);
    } catch (x) {
      setError(x.message);
    } finally {
      setLoading(false);
    }
  }

  async function match() {
    setLoading(true);
    setError("");

    try {
      const r = await getJobMatches(jobId.trim());
      setMatches(r.matches || []);
      setCandidates([]);
    } catch (x) {
      setError(x.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        Company candidate search
      </h1>

      <p className="text-gray-600">
        Search includes only candidates who have opted in to recruiter
        discovery.
      </p>

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={search}
        className="grid gap-3 rounded border p-4 sm:grid-cols-3"
      >
        <label>
          Keywords

          <input
            className="mt-1 w-full rounded border p-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="React, frontend, location"
          />
        </label>

        <label>
          Required skills

          <input
            className="mt-1 w-full rounded border p-2"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="React, Node.js"
          />
        </label>

        <button
          className="self-end rounded bg-black p-2 text-white"
          disabled={loading}
        >
          {loading ? "Searching…" : "Search candidates"}
        </button>
      </form>

      <section className="rounded border p-4">
        <h2 className="mb-3 text-xl font-semibold">
          Match candidates to a job
        </h2>

        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-64 flex-1 rounded border p-2"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="Existing Job ID owned by your account"
          />

          <button
            className="rounded border px-4"
            onClick={match}
            disabled={loading || !jobId.trim()}
          >
            Calculate matches
          </button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {candidates.map((p) => (
          <article
            className="rounded border p-4"
            key={p._id}
          >
            <h2 className="text-lg font-semibold">
              {p.headline || "Candidate"}
            </h2>

            <p className="text-sm text-gray-600">
              {p.location || "Location not provided"} ·{" "}
              {p.yearsExperience || 0} years
            </p>

            <p className="my-2 whitespace-pre-wrap">
              {p.summary}
            </p>

            <p className="text-sm">
              <b>Skills:</b>{" "}
              {(p.skills || []).join(", ") || "Not listed"}
            </p>
          </article>
        ))}

        {matches.map((m) => (
          <article
            className="rounded border p-4"
            key={m.profile._id}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {m.profile.headline || "Candidate"}
              </h2>

              <span className="rounded bg-gray-100 px-2 py-1 text-sm">
                {m.score}% match
              </span>
            </div>

            <p className="text-sm text-gray-600">
              {m.profile.location || "Location not provided"} ·{" "}
              {m.profile.yearsExperience || 0} years
            </p>

            <p className="mt-2 text-sm">
              <b>Matched skills:</b>{" "}
              {m.matchedSkills.join(", ") || "No exact skill overlap"}
            </p>

            <p className="text-sm">
              <b>Assessment average:</b>{" "}
              {m.assessmentScore === null
                ? "No submitted assessment data"
                : `${m.assessmentScore}%`}
            </p>
          </article>
        ))}
      </div>

      {!loading && !candidates.length && !matches.length && (
        <p className="text-gray-500">
          Search for candidates or calculate matches for one of your jobs.
        </p>
      )}
    </main>
  );
}
