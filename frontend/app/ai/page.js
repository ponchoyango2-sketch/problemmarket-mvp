'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ACTION_PROMPTS = {
  optimize: (text) =>
    `Optimiza y mejora esta respuesta, haciéndola más eficiente, clara y poderosa:\n\n"${text.slice(0, 400)}"`,
  business: (text) =>
    `Convierte esto en un plan de negocio completo con modelo de monetización, mercado objetivo y roadmap de lanzamiento:\n\n"${text.slice(0, 400)}"`,
  automate: (text) =>
    `¿Cómo automatizo esto completamente con tecnología? Dame stack recomendado, arquitectura y pasos de implementación:\n\n"${text.slice(0, 400)}"`,
};

const STARTERS = [
  'Tengo una idea de negocio, ¿cómo la monetizo rápido?',
  'Analiza las mejores oportunidades de IA en 2026',
  '¿Cómo construyo un SaaS rentable sin inversión inicial?',
  'Dame una estrategia de crecimiento para una startup nueva',
];

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg, onAction }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5`}>
      <div className={`max-w-[82%] ${isUser ? '' : 'w-full'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 ml-1">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              AI
            </div>
            <span className="text-xs text-gray-500 font-medium">ProblemMarket AI</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/30'
              : 'bg-gray-800/80 text-gray-100 rounded-tl-sm border border-gray-700/60'
          }`}
        >
          {msg.content}
        </div>
        {!isUser && (
          <div className="flex gap-2 mt-2 ml-1 flex-wrap">
            <button
              onClick={() => onAction('optimize', msg.content)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            >
              ✨ Optimizar
            </button>
            <button
              onClick={() => onAction('business', msg.content)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:border-violet-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
            >
              💡 Convertir en negocio
            </button>
            <button
              onClick={() => onAction('automate', msg.content)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:border-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
            >
              ⚙️ Automatizar esto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId] = useState(() => uuid());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, [input]);

  const send = useCallback(
    async (text) => {
      const userMsg = (text !== undefined ? text : input).trim();
      if (!userMsg || loading) return;
      setInput('');
      setError('');

      const updated = [...messages, { role: 'user', content: userMsg }];
      setMessages(updated);
      setLoading(true);

      try {
        const token = getToken();
        // Send previous messages as history (exclude the one we just added)
        const history = updated.slice(0, -1).slice(-18).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const data = await api.aiChat(
          { message: userMsg, history, sessionId },
          token
        );
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } catch (err) {
        setError(err.message || 'Error al conectar con la IA. Intenta de nuevo.');
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [input, loading, messages, sessionId]
  );

  function handleAction(type, content) {
    send(ACTION_PROMPTS[type](content));
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#080810] text-white overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#0d0d18]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-violet-500/30">
              AI
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">ProblemMarket AI</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Online
              </div>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5">GPT-4o-mini</span>
          <span>· 2026</span>
        </div>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-8 text-center">
              <div>
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-3xl font-bold mx-auto mb-5 shadow-2xl shadow-violet-500/40">
                  AI
                </div>
                <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-transparent">
                  ProblemMarket AI
                </h1>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  Tu advisor de negocios y tecnología. Pregúntame sobre ideas, código, estrategia o monetización.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left px-4 py-3 rounded-xl border border-white/8 bg-white/3 hover:border-violet-500/50 hover:bg-violet-500/5 text-sm text-gray-400 hover:text-gray-200 transition-all text-wrap"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} onAction={handleAction} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start mb-5">
              <div className="bg-gray-800/80 border border-gray-700/60 rounded-2xl rounded-tl-sm">
                <TypingIndicator />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex justify-center mb-4">
              <span className="text-xs text-red-400 bg-red-900/20 px-4 py-2 rounded-full border border-red-800/50">
                {error}
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3 border-t border-white/5 bg-[#0d0d18]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-gray-900/80 border border-white/8 rounded-2xl p-3 focus-within:border-violet-500/60 transition-all shadow-xl shadow-black/40">
            <textarea
              ref={(el) => {
                textareaRef.current = el;
                inputRef.current = el;
              }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pregúntame cualquier cosa..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent resize-none text-sm text-white placeholder-gray-600 outline-none leading-relaxed"
              style={{ maxHeight: '128px' }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-violet-500/20"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-700 text-center mt-2">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}
