'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { api } from '@/lib/api';
import RewardBadge from '@/components/RewardBadge';
import SolutionCard from '@/components/SolutionCard';

export default function ProblemPage() {
  const { id } = useParams();
  const router = useRouter();
  const [problem, setProblem] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [solution, setSolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadProblem() {
    try {
      const p = await api.getProblem(id);
      setProblem(p);
    } catch {
      setError('Problem not found.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setUser(getUser());
    setToken(getToken());
    loadProblem();
  }, [id]);

  async function handleSubmitSolution(e) {
    e.preventDefault();
    if (!user || !token) {
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.submitSolution(id, { author_id: user.id, content: solution }, token);
      setSolution('');
      setSuccess('✅ Your solution was submitted successfully!');
      await loadProblem();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectWinner(solutionId) {
    setError('');
    setSuccess('');
    try {
      const result = await api.selectWinner(id, { solutionId }, token);
      const net = Number(result.payout).toFixed(2);
      const fee = Number(result.commission).toFixed(2);
      setSuccess(`🏆 Winner selected! Net payout: ${problem.currency} ${net} (Platform earned: ${problem.currency} ${fee})`);
      await loadProblem();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <span className="animate-spin mr-2">⏳</span> Loading problem...
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p className="text-5xl mb-4">🔍</p>
        <p>Problem not found.</p>
        <Link href="/" className="text-sky-500 hover:underline text-sm mt-2 inline-block">← Back to marketplace</Link>
      </div>
    );
  }

  const isOwner = user && user.id === problem.publisher_id;
  const canSelect = isOwner && problem.status === 'open';
  const winner = (problem.solutions || []).find((s) => s.selected);
  const payout = (Number(problem.reward_amount) * 0.9).toFixed(2);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/" className="text-sm text-gray-400 hover:text-sky-500 transition">
        ← Back to marketplace
      </Link>

      {/* Problem header card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-7 mt-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-extrabold text-gray-900 flex-1 leading-snug">
            {problem.title}
          </h1>
          <span
            className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full border ${
              problem.status === 'open'
                ? 'bg-sky-100 text-sky-700 border-sky-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}
          >
            {problem.status === 'open' ? '🟢 Open' : '✅ Awarded'}
          </span>
        </div>

        {problem.description && (
          <p className="mt-3 text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">
            {problem.description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
          <RewardBadge amount={problem.reward_amount || 0} currency={problem.currency || 'USD'} size="lg" />
          <span className="text-sm text-gray-400">
            {(problem.solutions || []).length} solution{(problem.solutions || []).length !== 1 ? 's' : ''}
          </span>
          {problem.status === 'open' && (
            <span className="text-sm text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
              Winner gets {problem.currency} {payout}
            </span>
          )}
        </div>

        {winner && (
          <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-sm text-emerald-800">
            🏆 <strong>Problem solved!</strong> Winner received{' '}
            <strong>
              {problem.currency} {payout}
            </strong>
            . Platform commission:{' '}
            <strong>
              {problem.currency} {(Number(problem.reward_amount) * 0.1).toFixed(2)}
            </strong>
            .
          </div>
        )}

        {isOwner && problem.status === 'open' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            👑 You are the problem owner. Review solutions below and select the best one as winner.
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          {success}
        </div>
      )}

      {/* Solutions */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">
          Solutions ({(problem.solutions || []).length})
        </h2>
      </div>

      <div className="space-y-4 mb-8">
        {(problem.solutions || []).length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400">
            <p className="text-4xl mb-3">💡</p>
            <p className="text-sm">No solutions yet. Be the first to submit!</p>
          </div>
        ) : (
          problem.solutions.map((s) => (
            <SolutionCard
              key={s.id}
              solution={s}
              canSelect={canSelect}
              onSelect={handleSelectWinner}
              isWinner={!!s.selected}
            />
          ))
        )}
      </div>

      {/* Submit solution form */}
      {problem.status === 'open' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-7">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Submit your solution</h3>
          <p className="text-sm text-gray-400 mb-5">
            Describe your approach clearly. Good submissions get chosen.
          </p>

          {!user ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
              <Link href="/login" className="text-sky-500 font-medium hover:underline">
                Log in
              </Link>{' '}
              or{' '}
              <Link href="/register" className="text-sky-500 font-medium hover:underline">
                create an account
              </Link>{' '}
              to submit a solution.
            </div>
          ) : (
            <form onSubmit={handleSubmitSolution} className="space-y-4">
              <textarea
                rows={6}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none transition"
                placeholder="Describe your solution in detail. Be specific about your approach, why it works, and how to implement it..."
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-2xl transition disabled:opacity-60 text-sm"
              >
                {submitting ? 'Submitting...' : '📤 Submit Solution'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
