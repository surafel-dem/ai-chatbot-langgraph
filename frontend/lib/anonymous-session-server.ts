import { cookies } from 'next/headers';
import { ANONYMOUS_LIMITS, ANONYMOUS_SESSION_COOKIES_KEY } from './constants';

export interface AnonymousSession {
  id: string;
  remainingCredits: number;
  createdAt: string; // ISO string for cookie safety
}

export async function getAnonymousSession(): Promise<AnonymousSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionData = cookieStore.get(ANONYMOUS_SESSION_COOKIES_KEY)?.value;
    if (!sessionData) return null;
    const parsed = JSON.parse(sessionData) as AnonymousSession;
    return parsed;
  } catch {
    return null;
  }
}

export async function setAnonymousSession(session: AnonymousSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ANONYMOUS_SESSION_COOKIES_KEY, JSON.stringify(session), {
    path: '/',
    maxAge: ANONYMOUS_LIMITS.SESSION_DURATION,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // Keep non-HttpOnly so client banner and sidebar can reflect updated credits
    httpOnly: false,
  });
}

export async function createAnonymousSession(): Promise<AnonymousSession> {
  return {
    id: `guest-${Date.now()}`,
    remainingCredits: ANONYMOUS_LIMITS.CREDITS,
    createdAt: new Date().toISOString(),
  };
}

export async function clearAnonymousSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ANONYMOUS_SESSION_COOKIES_KEY);
}


