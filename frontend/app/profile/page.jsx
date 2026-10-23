
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardShell from "../components/DashboardShell";
import { apiRequest } from "../lib/api";

const emptyProfile = {
  name: "",
  bio: "",
  title: "",
  company: "",
  location: "",
  skills: [],
  github: "",
  linkedin: "",
  website: "",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [skillsText, setSkillsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const result = await apiRequest("/profile/me");

        if (!active) return;

        setProfile({ ...emptyProfile, ...result.profile });
        setSkillsText((result.profile.skills || []).join(", "));
      } catch (err) {
        if (!active) return;
        setError(err.message || "Unable to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;

    setProfile((current) => ({
      ...current,
      [name]: value,
    }));

    setSuccess("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const skills = [
        ...new Set(
          skillsText
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean)
        ),
      ];

      const result = await apiRequest("/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name,
          bio: profile.bio,
          title: profile.title,
          company: profile.company,
          location: profile.location,
          skills,
          github: profile.github,
          linkedin: profile.linkedin,
          website: profile.website,
        }),
      });

      setProfile({ ...emptyProfile, ...result.profile });
      setSkillsText((result.profile.skills || []).join(", "));
      setSuccess(result.message || "Profile saved successfully.");
    } catch (err) {
      setError(err.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-5 text-white">
        <h1 className="text-2xl font-bold">Unable to open your profile</h1>
        <p className="text-center text-slate-400">{error}</p>
        <Link
          href="/login"
          className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950"
        >
          Back to login
        </Link>
      </div>
    );
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400";

  return (
    <DashboardShell profile={profile}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Account settings
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            My Profile
          </h1>
          <p className="mt-3 text-slate-400">
            Update the information shown in your CodeArena workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-7 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-8"
        >
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"
            >
              {success}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">
              Full name *
              <input
                className={inputClass}
                name="name"
                value={profile.name || ""}
                onChange={updateField}
                maxLength={100}
                required
              />
            </label>

            <div className="text-sm font-medium text-slate-300">
              Email
              <div className={`${inputClass} text-slate-500`}>
                {profile.email}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Email changes are not supported here.
              </p>
            </div>

            <label className="text-sm font-medium text-slate-300">
              Professional title
              <input
                className={inputClass}
                name="title"
                value={profile.title || ""}
                onChange={updateField}
                placeholder="e.g. Full Stack Developer"
                maxLength={120}
              />
            </label>

            <label className="text-sm font-medium text-slate-300">
              Company
              <input
                className={inputClass}
                name="company"
                value={profile.company || ""}
                onChange={updateField}
                placeholder="Company or organization"
                maxLength={120}
              />
            </label>

            <label className="text-sm font-medium text-slate-300 sm:col-span-2">
              Location
              <input
                className={inputClass}
                name="location"
                value={profile.location || ""}
                onChange={updateField}
                placeholder="e.g. Delhi, India"
                maxLength={120}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-300">
            About me
            <textarea
              className={`${inputClass} min-h-32 resize-y`}
              name="bio"
              value={profile.bio || ""}
              onChange={updateField}
              placeholder="Write a short introduction..."
              maxLength={1000}
              rows={5}
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            Skills
            <input
              className={inputClass}
              value={skillsText}
              onChange={(event) => {
                setSkillsText(event.target.value);
                setSuccess("");
              }}
              placeholder="JavaScript, React, Node.js, MongoDB"
            />
            <p className="mt-2 text-xs text-slate-500">
              Separate each skill with a comma.
            </p>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-300">
              GitHub URL
              <input
                className={inputClass}
                name="github"
                value={profile.github || ""}
                onChange={updateField}
                placeholder="https://github.com/username"
                maxLength={300}
              />
            </label>

            <label className="text-sm font-medium text-slate-300">
              LinkedIn URL
              <input
                className={inputClass}
                name="linkedin"
                value={profile.linkedin || ""}
                onChange={updateField}
                placeholder="https://linkedin.com/in/username"
                maxLength={300}
              />
            </label>

            <label className="text-sm font-medium text-slate-300 sm:col-span-2">
              Personal website
              <input
                className={inputClass}
                name="website"
                value={profile.website || ""}
                onChange={updateField}
                placeholder="https://example.com"
                maxLength={300}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-slate-200 hover:bg-white/5"
            >
              Back to dashboard
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
