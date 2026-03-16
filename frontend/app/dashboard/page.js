'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { api } from '@/lib/api';
import ProblemCard from '@/components/ProblemCard';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [myProblems, setMyProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    const t = getToken();
    if (!u || !t) {
      router.push('/login');
      return;
    }
    setUser(u);
    api
      .getProblems()
      .then((all) => setMyProblems(all.filter((p) => p.publisher_id === u.id)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span className="animate-spin mr-2">⏳</span> Loading...
      </div>
    );
  }

  const open = myProblems.filter((p) => p.status === 'open');
  const awarded = myProblems.filter((p) => p.status === 'awarded');

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Hello, <span className="font-semibold text-sky-600">{user?.name}</span> 👋
          </p>
        </div>
        <Link
          href="/problems/new"
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2.5 rounded-2xl transition text-sm"
        >
          + Post New Problem
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Total Posted', value: myProblems.length, color: 'text-gray-900' },
          { label: 'Open', value: open.length, color: 'text-sky-600' },
          { label: 'Awarded', value: awarded.length, color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wide">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Problems list */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-5">My Problems</h2>
        {myProblems.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl">
            <p className="text-4xl mb-3">🧩</p>
            <p className="text-gray-400 text-sm">No problems posted yet.</p>
            <Link
              href="/problems/new"
              className="mt-3 inline-block text-sky-500 hover:underline text-sm font-medium"
            >
              Post your first challenge →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {myProblems.map((p) => (
              <ProblemCard key={p.id} problem={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
