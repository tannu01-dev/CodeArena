
"use client";

import { useEffect, useState } from "react";
import {
  getCandidateProfile,
  saveCandidateProfile,
  updateSearchConsent,
  eraseCandidateProfile,
} from "../../lib/phase11to14";

const empty = {
  headline: "",
  summary: "",
  skills: "",
  yearsExperience: "0",
  location: "",
  searchable: false,
  links: "",
};

export default function TalentProfilePage() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCandidateProfile()
      .then(({ profile }) => {
        if (profile) {
          setForm({
            headline: profile.headline || "",
            summary: profile.summary || "",
            skills: (profile.skills || []).join(", "),
            yearsExperience: String(profile.yearsExperience || 0),
            location: profile.location || "",
            searchable: Boolean(profile.searchable),
            links: (profile.links || [])
              .map((x) => `${x.label}|${x.url}`)
              .join("\n"),
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) =>
    setForm((old) => ({
      ...old,
      [key]: value,
    }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const links = form.links
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((line) => {
          const i = line.indexOf("|");

          return i < 1
            ? { label: line, url: "" }
            : {
                label: line.slice(0, i).trim(),
                url: line.slice(i + 1).trim(),
              };
        });

      const result = await saveCandidateProfile({
        headline: form.headline,
        summary: form.summary,
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExperience: Number(form.yearsExperience),
        location: form.location,
        links,
      });

      setForm((old) => ({
        ...old,
        searchable: Boolean(result.profile.searchable),
      }));

      setMessage("Profile saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function consent(value) {
    setError("");

    try {
      await updateSearchConsent(value);

      set("searchable", value);

      setMessage(
        value
          ? "Recruiter search enabled."
          : "Recruiter search disabled."
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function erase() {
    if (
      !window.confirm(
        "Erase your talent profile and remove it from recruiter search? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await eraseCandidateProfile();

      setForm(empty);
      setMessage("Profile erased.");
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) {
    return <main className="p-6">Loading profile…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <h1 className="text-3xl font-bold">
        Candidate talent profile
      </h1>

      <p className="text-gray-600">
        Only saved profile data is used. Recruiters can find your
        profile only when you explicitly enable search consent.
      </p>

      {message && (
        <p className="rounded bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}

      <form
        onSubmit={save}
        className="space-y-4 rounded border p-5"
      >
        <label className="block">
          Headline

          <input
            className="mt-1 w-full rounded border p-2"
            maxLength={180}
            value={form.headline}
            onChange={(e) => set("headline", e.target.value)}
          />
        </label>

        <label className="block">
          Professional summary

          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={4}
            maxLength={4000}
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </label>

        <label className="block">
          Skills (comma-separated)

          <input
            className="mt-1 w-full rounded border p-2"
            value={form.skills}
            onChange={(e) => set("skills", e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            Years of experience

            <input
              className="mt-1 w-full rounded border p-2"
              type="number"
              min="0"
              max="70"
              value={form.yearsExperience}
              onChange={(e) =>
                set("yearsExperience", e.target.value)
              }
            />
          </label>

          <label>
            Location

            <input
              className="mt-1 w-full rounded border p-2"
              maxLength={160}
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </label>
        </div>

        <label className="block">
          Links (one per line: Label|https://example.com)

          <textarea
            className="mt-1 w-full rounded border p-2"
            rows={3}
            value={form.links}
            onChange={(e) => set("links", e.target.value)}
          />
        </label>

        <button
          disabled={saving}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      <section className="space-y-3 rounded border p-5">
        <h2 className="text-xl font-semibold">
          Privacy & consent
        </h2>

        <p>
          Search consent is optional. Turning it off removes your
          profile from recruiter search; it does not delete your
          assessment history.
        </p>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.searchable}
            onChange={(e) => consent(e.target.checked)}
          />

          Allow recruiters to discover my profile
        </label>

        <button
          onClick={erase}
          className="rounded border border-red-500 px-4 py-2 text-red-700"
        >
          Erase talent profile
        </button>
      </section>
    </main>
  );
}
