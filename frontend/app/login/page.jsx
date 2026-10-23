
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const user = await login(email.trim().toLowerCase(), password);

      router.replace(
        user.role === "admin"
          ? "/dashboard?role=admin"
          : user.role === "recruiter"
            ? "/dashboard?role=recruiter"
            : "/dashboard"
      );
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/85 p-7 shadow-2xl shadow-black/30 sm:p-10">
        <Link href="/" className="text-2xl font-black tracking-tight">
          Code<span className="text-cyan-400">Arena</span>
        </Link>

        <div className="mb-8 mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">
            Welcome back
          </p>
          <h1 className="mt-3 text-3xl font-bold">Log in to your account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Continue your coding journey with CodeArena.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Password
            </label>
            <div className="flex rounded-xl border border-white/10 bg-slate-950/70 focus-within:border-violet-400">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
                placeholder="Enter your password"
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
            {busy ? "Signing in..." : "Log in →"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-400">
          New to CodeArena?{" "}
          <Link href="/signup" className="font-semibold text-violet-300 hover:text-violet-200">
            Create an account
          </Link>
        </p>

        <p className="mt-8 text-center text-xs leading-5 text-slate-500">
          Your session is managed using a secure, HTTP-only cookie.
        </p>
      </section>
    </main>
  );
}
