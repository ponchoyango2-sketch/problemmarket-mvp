import Link from 'next/link';

export default function PaymentSuccessPage({ searchParams }) {
  const sessionId = searchParams?.session_id;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="bg-white rounded-3xl border border-emerald-200 p-8 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-3xl font-extrabold text-gray-900">Pago recibido</h1>
        <p className="mt-3 text-gray-600">
          Tu pago fue confirmado. Estamos publicando tu reto ahora mismo.
        </p>
        {sessionId && (
          <p className="mt-2 text-xs text-gray-400 break-all">Session: {sessionId}</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2.5 rounded-xl transition"
          >
            Ir al marketplace
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-5 py-2.5 rounded-xl transition"
          >
            Ver dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
