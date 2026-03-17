import Link from 'next/link';

export default function PaymentCancelPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <h1 className="text-3xl font-extrabold text-gray-900">Pago cancelado</h1>
        <p className="mt-3 text-gray-600">
          No se publico el reto porque el pago obligatorio fue cancelado.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/problems/new"
            className="inline-flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2.5 rounded-xl transition"
          >
            Intentar nuevamente
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-5 py-2.5 rounded-xl transition"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
