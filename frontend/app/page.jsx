import Link from "next/link";

const features = [
  { title: "Coding assessments", description: "Create assessments, solve problems, and track submitted attempts." },
  { title: "Talent and hiring", description: "Maintain candidate profiles, publish jobs, and manage applications." },
  { title: "Reports and integrity", description: "Review assessment results and monitor assessment integrity events." },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="text-2xl font-black tracking-tight">Code<span className="text-cyan-400">Arena</span></Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="rounded-xl px-4 py-2 font-semibold text-slate-200 hover:bg-white/10">Log in</Link>
            <Link href="/signup" className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950 hover:bg-cyan-300">Create account</Link>
          </nav>
        </header>
        <section className="grid items-center gap-12 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-cyan-300">Coding · Assessment · Hiring</p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">A workspace for proving skills and finding talent.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">Use CodeArena to practice coding, take assessments, build your profile, and manage technical hiring. Sign in to load your account data from the connected API.</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/signup" className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 font-bold shadow-lg shadow-violet-950/40 hover:brightness-110">Get started →</Link>
              <Link href="/login" className="rounded-xl border border-white/15 px-6 py-3.5 font-semibold hover:bg-white/5">I already have an account</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-300">Platform features</p>
            <div className="mt-6 space-y-5">
              {features.map((feature, index) => (
                <div key={feature.title} className="flex gap-4 border-b border-white/10 pb-5 last:border-0 last:pb-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 font-bold text-cyan-300">0{index + 1}</span>
                  <div><h2 className="font-bold">{feature.title}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{feature.description}</p></div>
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100/80">Live features require the backend API and MongoDB to be running.</p>
          </div>
        </section>
        <footer className="border-t border-white/10 py-6 text-sm text-slate-500">CodeArena · Your account data is loaded after sign-in.</footer>
      </div>
    </main>
  );
}
