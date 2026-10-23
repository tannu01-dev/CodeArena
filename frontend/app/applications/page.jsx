
"use client";

import { useEffect, useState } from "react";
import {
  getMyApplications,
  getMyInvitations,
  respondInvitation,
} from "../lib/phase11to14";

export default function ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setError("");

    try {
      const [a, i] = await Promise.all([
        getMyApplications(),
        getMyInvitations(),
      ]);

      setApps(a.applications || []);
      setInvitations(i.invitations || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id, status) {
    try {
      await respondInvitation(id, status);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-7 p-6">
      <h1 className="text-3xl font-bold">
        Applications &amp; invitations
      </h1>

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading saved applications…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-xl font-semibold">
              My applications
            </h2>

            <div className="space-y-3">
              {apps.map((a) => (
                <article
                  className="rounded border p-4"
                  key={a._id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">
                        {a.jobId?.title || "Job removed"}
                      </h3>

                      <p className="text-sm text-gray-600">
                        {a.jobId?.company}
                        {" · Applied "}
                        {a.appliedAt
                          ? new Date(
                              a.appliedAt
                            ).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>

                    <span className="rounded bg-gray-100 px-3 py-1">
                      {a.status}
                    </span>
                  </div>

                  <ol className="mt-3 space-y-1 text-sm">
                    {(a.history || []).map((h, i) => (
                      <li key={`${a._id}-${i}`}>
                        {h.stage}
                        {" — "}
                        {new Date(h.changedAt).toLocaleString()}
                        {" "}
                        {h.note && `· ${h.note}`}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}

              {!apps.length && (
                <p>No applications submitted yet.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">
              Interview &amp; assessment invitations
            </h2>

            <div className="space-y-3">
              {invitations.map((i) => (
                <article
                  className="rounded border p-4"
                  key={i._id}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="font-semibold">
                      {i.title}
                    </h3>

                    <span className="rounded bg-gray-100 px-3 py-1">
                      {i.status}
                    </span>
                  </div>

                  <p>{i.message}</p>

                  <p className="text-sm text-gray-600">
                    {i.type}
                    {" · "}
                    {i.scheduledAt
                      ? new Date(
                          i.scheduledAt
                        ).toLocaleString()
                      : "Time not scheduled"}
                    {" · "}
                    {i.jobId?.title || ""}
                  </p>

                  {i.meetingUrl && (
                    <a
                      className="underline"
                      href={i.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Meeting link
                    </a>
                  )}

                  {i.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded bg-black px-3 py-2 text-white"
                        onClick={() =>
                          respond(i._id, "accepted")
                        }
                      >
                        Accept
                      </button>

                      <button
                        className="rounded border px-3 py-2"
                        onClick={() =>
                          respond(i._id, "declined")
                        }
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </article>
              ))}

              {!invitations.length && (
                <p>No invitations received.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
