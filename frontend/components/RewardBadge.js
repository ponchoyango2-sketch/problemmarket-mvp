export default function RewardBadge({ amount, currency = 'USD', size = 'md' }) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5 font-bold',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200 ${sizes[size] || sizes.md}`}
    >
      <span>💰</span>
      <span>
        {currency}{' '}
        {Number(amount).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </span>
  );
}
