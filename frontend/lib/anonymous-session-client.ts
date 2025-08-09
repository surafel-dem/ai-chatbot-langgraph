'use client';

import { ANONYMOUS_LIMITS, ANONYMOUS_SESSION_COOKIES_KEY } from './constants';

export interface AnonymousSessionClient {
  id: string;
  remainingCredits: number;
  createdAt: string; // ISO string for cookie safety
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift() || null;
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const encodedValue = encodeURIComponent(value);
  document.cookie = `${name}=${encodedValue}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Max-Age=0`;
}

export function createAnonymousSession(): AnonymousSessionClient {
  return {
    id: `guest-${Date.now()}`,
    remainingCredits: ANONYMOUS_LIMITS.CREDITS,
    createdAt: new Date().toISOString(),
  };
}

export function getAnonymousSession(): AnonymousSessionClient | null {
  try {
    const sessionData = getCookie(ANONYMOUS_SESSION_COOKIES_KEY);
    if (!sessionData) return null;
    const session = JSON.parse(sessionData) as AnonymousSessionClient;
    return session;
  } catch {
    return null;
  }
}

export function setAnonymousSession(session: AnonymousSessionClient): void {
  setCookie(
    ANONYMOUS_SESSION_COOKIES_KEY,
    JSON.stringify(session),
    ANONYMOUS_LIMITS.SESSION_DURATION,
  );
}

export function clearAnonymousSession(): void {
  deleteCookie(ANONYMOUS_SESSION_COOKIES_KEY);
}


