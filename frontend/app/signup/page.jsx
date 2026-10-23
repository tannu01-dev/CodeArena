
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "candidate"
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (form.password.length < 8 || form.password.length > 72) {
      setError("Password must contain 8 to 72 characters.");
      return;
    }

    setBusy(true);

    try {
      const user = await signup({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase()
      });

      router.replace(
        user.role === "recruiter"
          ? "/dashboard?role=recruiter"
          : "/dashboard"
      );
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30 md:grid-cols-2">
        <aside className="hidden flex-col justify-between bg-gradient-to-br from-violet-600 via-indigo-700 to-slate-900 p-10 md:flex">
          <Link href="/" className="text-2xl font-black tracking-tight">
            Code<span className="text-cyan-300">Arena</span>
          </Link>

          <div>
            <div className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
              Your next opportunity starts here
            </div>
            <h1 className="text-4xl font-bold leading-tight">
              Build skills.
              <br />
              Prove your code.
              <br />
              Get discovered.
            </h1>
            <p className="mt-5 leading-7 text-indigo-100">
              Practice technical assessments and connect your coding skills
              with real opportunities.
            </p>
          </div>

          <p className="text-sm text-indigo-200">
            A smarter space for developers and hiring teams.
          </p>
        </aside>

        <div className="p-6 sm:p-10">
          <Link href="/" className="text-xl font-black md:hidden">
            Code<span className="text-cyan-400">Arena</span>
          </Link>

          <div className="mb-8 mt-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
              Create account
            </p>
            <h2 className="mt-3 text-3xl font-bold">Join CodeArena</h2>
            <p className="mt-2 text-sm text-slate-400">
              Set up your account in a few simple steps.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">
                Full name
              </label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                onChange={update}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={form.email}
                onChange={update}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label htmlFor="role" className="mb-2 block text-sm font-medium">
                I want to join as
              </label>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={update}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-violet-400"
              >
                <option value="candidate">Candidate — practice and grow</option>
                <option value="recruiter">Recruiter — evaluate talent</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">
                Password
              </label>
              <div className="flex rounded-xl border border-white/10 bg-slate-950/70 focus-within:border-violet-400">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={form.password}
                  onChange={update}
                  placeholder="At least 8 characters"
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-4 text-sm text-slate-400 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 font-semibold shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Creating account..." : "Create account →"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-400">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-violet-300 hover:text-violet-200">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
