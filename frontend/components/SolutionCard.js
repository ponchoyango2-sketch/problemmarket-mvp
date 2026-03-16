'use client';

import { useState } from 'react';

export default function SolutionCard({ solution, canSelect, onSelect, isWinner }) {
  const [loading, setLoading] = useState(false);

  async function handleSelect() {
    setLoading(true);
    await onSelect(solution.id);
    setLoading(false);
  }

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isWinner
          ? 'border-emerald-300 bg-emerald-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{solution.content}</p>
          <p className="text-xs text-gray-400 mt-2">
            By <span className="font-medium text-gray-500">{solution.author_name || solution.author_id?.slice(0, 8) + '...'}</span>
            {' · '}
            {new Date(solution.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </p>
        </div>
        {isWinner && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
            🏆 Winner
          </span>
        )}
      </div>

      {canSelect && !isWinner && (
        <button
          onClick={handleSelect}
          disabled={loading}
          className="mt-4 text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Selecting...' : '🏆 Select as Winner'}
        </button>
      )}
    </div>
  );
}
