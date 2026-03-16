'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  function logout() {
    clearAuth();
    setUser(null);
    router.push('/');
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-sky-600 tracking-tight">Problem<span className="text-gray-900">Market</span></span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/problems/new"
            className="text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-xl transition"
          >
            + Post Problem
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-sky-600 transition">
                Dashboard
              </Link>
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">{user.name}</span>
                <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium transition">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-sky-600 transition">
                Log in
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 px-4 py-2 rounded-xl transition"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden text-gray-500" onClick={() => setMenuOpen(!menuOpen)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-6 pb-4 border-t border-gray-100 space-y-2 pt-3">
          <Link href="/problems/new" className="block text-sm font-semibold text-sky-600">+ Post Problem</Link>
          {user ? (
            <>
              <Link href="/dashboard" className="block text-sm text-gray-600">Dashboard</Link>
              <span className="block text-sm text-gray-500">{user.name}</span>
              <button onClick={logout} className="text-sm text-red-500">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-sm text-gray-600">Log in</Link>
              <Link href="/register" className="block text-sm text-gray-600">Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
