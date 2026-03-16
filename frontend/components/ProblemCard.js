import Link from 'next/link';
import RewardBadge from './RewardBadge';

const statusConfig = {
  open: { label: 'Open', classes: 'bg-sky-100 text-sky-700 border-sky-200' },
  awarded: { label: 'Awarded', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', classes: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export default function ProblemCard({ problem }) {
  const status = statusConfig[problem.status] || statusConfig.open;

  return (
    <Link
      href={`/problems/${problem.id}`}
      className="group flex flex-col bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-sky-300 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-gray-900 group-hover:text-sky-600 text-base leading-snug flex-1 transition">
          {problem.title}
        </h3>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${status.classes}`}
        >
          {status.label}
        </span>
      </div>

      {problem.description && (
        <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-3">{problem.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
        <RewardBadge amount={problem.reward_amount || 0} currency={problem.currency || 'USD'} />
        <span className="text-xs text-gray-400">
          {problem.solutions_count ?? (problem.solutions?.length ?? 0)} solution
          {(problem.solutions_count ?? problem.solutions?.length ?? 0) !== 1 ? 's' : ''}
        </span>
      </div>
    </Link>
  );
}
