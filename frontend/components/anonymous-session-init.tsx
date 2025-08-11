'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  getAnonymousSession,
  createAnonymousSession,
  setAnonymousSession,
  clearAnonymousSession,
} from '@/lib/anonymous-session-client';

export function AnonymousSessionInit() {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    // Only initialize for non-authenticated users
    if (user) return;

    const existing = getAnonymousSession();
    if (!existing) {
      const s = createAnonymousSession();
      setAnonymousSession(s);
    }
  }, [isLoaded, user]);

  return null;
}


