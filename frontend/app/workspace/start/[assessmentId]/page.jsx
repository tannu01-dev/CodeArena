
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "../../../lib/api";

export default function StartWorkspacePage() {
  const params = useParams();
  const router = useRouter();

  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await apiRequest(
          `/assessments/${params.assessmentId}/attempts`,
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );

        const id =
          data?.attempt?._id ||
          data?.attemptId ||
          data?._id;

        if (!id) {
          throw new Error(
            "Attempt start response did not include an attempt ID."
          );
        }

        if (active) {
          router.replace(`/workspace/${id}`);
        }
      } catch (e) {
        if (active) {
          setError(
            e.message || "Unable to start assessment."
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [params.assessmentId, router]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto mt-24 max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8">
        <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-cyan-300">
          CodeArena Workspace
        </div>

        <h1 className="text-2xl font-bold">
          Preparing your assessment
        </h1>

        {error ? (
          <>
            <p className="mt-4 text-rose-300">
              {error}
            </p>

            <Link
              href="/assessments"
              className="mt-6 inline-block rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950"
            >
              Back to assessments
            </Link>
          </>
        ) : (
          <p className="mt-3 text-slate-400">
            Starting or recovering your attempt…
          </p>
        )}
      </div>
    </main>
  );
}
