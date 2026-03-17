import Link from 'next/link';
import ProblemCard from '@/components/ProblemCard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getProblems() {
  try {
    const res = await fetch(API_BASE + '/problems', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const problems = await getProblems();
  const open = problems.filter((p) => p.status === 'open' || p.status === 'published');
  const awarded = problems.filter((p) => p.status === 'awarded');

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white px-6 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-block bg-white/10 border border-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
            Global Intelligence Marketplace
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Post a Problem.<br />The World Solves It.
          </h1>
          <p className="mt-5 text-sky-100 text-lg max-w-xl mx-auto leading-relaxed">
            Publish any challenge with a reward. The best talent globally competes. You pick the winner and release the prize.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/problems/new"
              className="bg-white text-sky-700 font-bold px-8 py-3.5 rounded-2xl hover:bg-sky-50 transition shadow-lg text-sm"
            >
              🚀 Post a Problem
            </Link>
            <Link
              href="/register"
              className="border-2 border-white/60 text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-white/10 transition text-sm"
            >
              Join as Solver →
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-7 grid grid-cols-3 divide-x divide-gray-100 text-center">
          <div className="px-4">
            <p className="text-3xl font-extrabold text-sky-600">{problems.length}</p>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Total Problems</p>
          </div>
          <div className="px-4">
            <p className="text-3xl font-extrabold text-emerald-500">{open.length}</p>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Open Challenges</p>
          </div>
          <div className="px-4">
            <p className="text-3xl font-extrabold text-amber-500">{awarded.length}</p>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">Problems Solved</p>
          </div>
        </div>
      </section>

      {/* Open Challenges */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Open Challenges</h2>
            <p className="text-sm text-gray-400 mt-0.5">Submit your solution and compete for the reward</p>
          </div>
          <Link href="/problems/new" className="text-sm text-sky-600 hover:text-sky-800 font-medium transition">
            + Post yours →
          </Link>
        </div>

        {open.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400">
            <p className="text-5xl mb-4">🧩</p>
            <p className="font-medium text-gray-500">No open challenges yet.</p>
            <Link href="/problems/new" className="mt-2 inline-block text-sky-500 hover:underline text-sm">
              Be the first to post a problem →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {open.map((p) => (
              <ProblemCard key={p.id} problem={p} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-gray-100 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">How it works</h2>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { icon: '📝', title: 'Post a Problem', desc: 'Describe your challenge, set a reward and deposit it in escrow.' },
            { icon: '🌍', title: 'World Competes', desc: 'Solvers from around the globe submit their best solutions.' },
            { icon: '🏆', title: 'Pick & Pay', desc: 'You choose the winning solution. Payment releases instantly.' },
          ].map((step) => (
            <div key={step.title} className="flex flex-col items-center gap-3">
              <span className="text-4xl">{step.icon}</span>
              <h3 className="font-semibold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
