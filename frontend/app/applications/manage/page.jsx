
"use client";

import { useState } from "react";
import {
  getJobApplications,
  updateApplicationStage,
  createHiringInvitation,
} from "../../lib/phase11to14";

const stages = [
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "hired",
  "rejected",
];

export default function HiringPipelinePage() {
  const [jobId, setJobId] = useState("");
  const [apps, setApps] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState({});

  const [invite, setInvite] = useState({
    candidateId: "",
    applicationId: "",
    title: "",
    type: "interview",
    scheduledAt: "",
    meetingUrl: "",
    message: "",
    assessmentId: "",
    jobId: "",
  });

  async function load(e) {
    e?.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const r = await getJobApplications(jobId.trim());
      setApps(r.applications || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function stage(id, status) {
    setError("");
    setMessage("");

    try {
      await updateApplicationStage(id, status, note[id] || "");

      setMessage("Application stage updated.");

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendInvite(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      const body = {
        ...invite,
        jobId: invite.jobId || jobId.trim() || null,
        applicationId: invite.applicationId || null,
        assessmentId: invite.assessmentId || null,
        scheduledAt: invite.scheduledAt
          ? new Date(invite.scheduledAt).toISOString()
          : null,
      };

      await createHiringInvitation(body);

      setMessage(
        "Invitation saved and sent to the candidate inbox."
      );

      setInvite((o) => ({
        ...o,
        candidateId: "",
        applicationId: "",
        title: "",
        message: "",
        meetingUrl: "",
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-7 p-6">
      <h1 className="text-3xl font-bold">
        Hiring pipeline
      </h1>

      <p className="text-gray-600">
        Recruiters can update applications only for jobs they own.
        Use real IDs from saved jobs and applications.
      </p>

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}

      <form
        onSubmit={load}
        className="flex flex-wrap gap-2 rounded border p-4"
      >
        <input
          required
          className="min-w-64 flex-1 rounded border p-2"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          placeholder="Job ID"
        />

        <button
          className="rounded bg-black px-4 py-2 text-white"
          disabled={loading}
        >
          {loading ? "Loading…" : "Load applications"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Applications
        </h2>

        {apps.map((a) => (
          <article
            key={a._id}
            className="space-y-3 rounded border p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <b>{a.candidateId?.name || "Candidate"}</b>

                <p className="text-sm text-gray-600">
                  {a.candidateId?.email || a.candidateId?._id}
                  {" · Application "}
                  {a._id}
                </p>
              </div>

              <span className="rounded bg-gray-100 px-3 py-1">
                {a.status}
              </span>
            </div>

            <label className="block text-sm">
              Internal note

              <input
                className="mt-1 w-full rounded border p-2"
                value={note[a._id] || ""}
                onChange={(e) =>
                  setNote((o) => ({
                    ...o,
                    [a._id]: e.target.value,
                  }))
                }
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <select
                className="rounded border p-2"
                value={a.status}
                onChange={(e) =>
                  stage(a._id, e.target.value)
                }
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="rounded border px-3 py-2"
                onClick={() =>
                  setInvite((o) => ({
                    ...o,
                    candidateId: String(
                      a.candidateId?._id || a.candidateId
                    ),
                    applicationId: a._id,
                    jobId: String(jobId),
                  }))
                }
              >
                Invite this candidate
              </button>
            </div>

            <div className="text-sm text-gray-500">
              History:{" "}
              {(a.history || [])
                .map((h) => h.stage)
                .join(" → ")}
            </div>
          </article>
        ))}

        {!apps.length && (
          <p>
            No applications loaded. Enter a job ID owned by your
            recruiter account.
          </p>
        )}
      </section>

      <form
        onSubmit={sendInvite}
        className="grid gap-3 rounded border p-5 sm:grid-cols-2"
      >
        <h2 className="text-xl font-semibold sm:col-span-2">
          Create interview / assessment invitation
        </h2>

        <label>
          Candidate user ID
          <input
            required
            className="mt-1 w-full rounded border p-2"
            value={invite.candidateId}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                candidateId: e.target.value,
              }))
            }
          />
        </label>

        <label>
          Application ID (optional)
          <input
            className="mt-1 w-full rounded border p-2"
            value={invite.applicationId}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                applicationId: e.target.value,
              }))
            }
          />
        </label>

        <label>
          Title
          <input
            required
            className="mt-1 w-full rounded border p-2"
            value={invite.title}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                title: e.target.value,
              }))
            }
          />
        </label>

        <label>
          Type
          <select
            className="mt-1 w-full rounded border p-2"
            value={invite.type}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                type: e.target.value,
              }))
            }
          >
            <option value="interview">Interview</option>
            <option value="assessment">Assessment</option>
          </select>
        </label>

        <label>
          Scheduled time
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border p-2"
            value={invite.scheduledAt}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                scheduledAt: e.target.value,
              }))
            }
          />
        </label>

        <label>
          Meeting URL
          <input
            type="url"
            className="mt-1 w-full rounded border p-2"
            value={invite.meetingUrl}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                meetingUrl: e.target.value,
              }))
            }
          />
        </label>

        <label>
          Assessment ID (optional)
          <input
            className="mt-1 w-full rounded border p-2"
            value={invite.assessmentId}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                assessmentId: e.target.value,
              }))
            }
          />
        </label>

        <label>
          Job ID (optional)
          <input
            className="mt-1 w-full rounded border p-2"
            value={invite.jobId}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                jobId: e.target.value,
              }))
            }
          />
        </label>

        <label className="sm:col-span-2">
          Message
          <textarea
            rows={3}
            className="mt-1 w-full rounded border p-2"
            value={invite.message}
            onChange={(e) =>
              setInvite((o) => ({
                ...o,
                message: e.target.value,
              }))
            }
          />
        </label>

        <button className="w-fit rounded bg-black px-4 py-2 text-white">
          Create invitation
        </button>
      </form>
    </main>
  );
}
