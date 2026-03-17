'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 60000;

export default function PaymentSuccessPage() {
  const [sessionId, setSessionId] = useState('');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get('session_id') || '');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function pollStatus() {
      const token = getToken();
      if (!sessionId) {
        setError('No se encontro el session_id del pago.');
        setLoading(false);
        return;
      }
      if (!token) {
        setError('Inicia sesion para verificar el estado del pago.');
        setLoading(false);
        return;
      }

      const startedAt = Date.now();

      while (!cancelled) {
        try {
          const data = await api.getCheckoutSessionStatus(sessionId, token);
          if (cancelled) return;

          setStatus(data);
          setError('');
          setLoading(false);

          if (data.isPublished) {
            return;
          }
        } catch (err) {
          if (cancelled) return;
          setLoading(false);
          setError(err.message || 'No pudimos confirmar el estado del pago.');
        }

        if (Date.now() - startedAt >= MAX_POLL_MS) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    pollStatus();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isPublished = !!status?.isPublished;
  const problemLink = status?.problem?.id ? `/problems/${status.problem.id}` : '/dashboard';

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="bg-white rounded-3xl border border-emerald-200 p-8 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-3xl font-extrabold text-gray-900">Pago recibido</h1>

        {loading ? (
          <p className="mt-3 text-gray-600">Verificando estado de publicacion...</p>
        ) : isPublished ? (
          <p className="mt-3 text-emerald-700 font-medium">
            Tu reto ya fue publicado correctamente.
          </p>
        ) : (
          <p className="mt-3 text-amber-700">
            Pago confirmado. El webhook de Stripe aun esta finalizando la publicacion.
          </p>
        )}

        {status && (
          <div className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-left">
            <p>
              <span className="font-semibold">Checkout:</span> {status.checkoutStatus || 'unknown'}
            </p>
            <p>
              <span className="font-semibold">Pago:</span> {status.paymentStatus || 'unknown'}
            </p>
            <p>
              <span className="font-semibold">Reto:</span> {status.problem?.status || 'pending_payment'}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {sessionId && (
          <p className="mt-3 text-xs text-gray-400 break-all">Session: {sessionId}</p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={problemLink}
            className="inline-flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {isPublished ? 'Ver reto publicado' : 'Ver dashboard'}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-5 py-2.5 rounded-xl transition"
          >
            Ir al marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
