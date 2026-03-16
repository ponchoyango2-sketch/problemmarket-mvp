'use client';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pm_token');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('pm_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token, user) {
  localStorage.setItem('pm_token', token);
  localStorage.setItem('pm_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_user');
}
