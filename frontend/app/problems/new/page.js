'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken, getUser } from '@/lib/auth';
import { api } from '@/lib/api';
import RewardBadge from '@/components/RewardBadge';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'BRL', 'CAD'];

export default function NewProblemPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    reward: '',
    currency: 'USD',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      router.push('/login');
      return;
    }
    if (Number(form.reward) <= 0) {
      setError('Reward must be greater than 0');
      return;
    }
    setLoading(true);
    try {
      const data = await api.createProblem(
        {
          publisher_id: user.id,
          title: form.title,
          description: form.description,
          reward: { amount: Number(form.reward), currency: form.currency },
        },
        token
      );
      router.push(`/problems/${data.problem.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const payout = form.reward ? (Number(form.reward) * 0.9).toFixed(2) : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-sky-500 transition">
          ← Back to marketplace
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 mt-3">Post a Problem</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Describe your challenge clearly, set a reward and let the world solve it.
        </p>
      </div>

      {error && (
        <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-200 p-7 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Problem title <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            placeholder="e.g. Optimize our delivery route algorithm to reduce time by 20%"
            value={form.title}
            onChange={update('title')}
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
          <textarea
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none transition"
            placeholder="Describe the problem in full detail:&#10;• What is the current situation?&#10;• What outcome do you need?&#10;• What format should the solution be (code, document, prototype)?&#10;• How will you evaluate submissions?"
            value={form.description}
            onChange={update('description')}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Reward amount <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
              placeholder="500.00"
              value={form.reward}
              onChange={update('reward')}
              required
            />
          </div>
          <div className="w-28">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Currency</label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition bg-white"
              value={form.currency}
              onChange={update('currency')}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fee preview */}
        {payout && (
          <div className="flex items-center justify-between bg-sky-50 border border-sky-100 rounded-xl px-5 py-4">
            <div className="text-sm text-sky-700">
              <span className="font-semibold">Platform fee:</span> 10% = {form.currency} {(Number(form.reward) * 0.1).toFixed(2)}
            </div>
            <div className="flex items-center gap-2 text-sm text-sky-700">
              <span>Winner receives:</span>
              <RewardBadge amount={payout} currency={form.currency} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3.5 rounded-2xl transition disabled:opacity-60 text-sm"
        >
          {loading ? 'Posting...' : '🚀 Post Problem with Reward'}
        </button>
      </form>
    </div>
  );
}
