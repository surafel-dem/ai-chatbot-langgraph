'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CreditLimitDisplayProps {
  className?: string;
}

export function CreditLimitDisplay({ className }: CreditLimitDisplayProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('anonymous-session='));
    if (!cookie) return;
    try {
      const value = decodeURIComponent(cookie.split('=')[1]);
      const parsed = JSON.parse(value);
      if (typeof parsed?.remainingCredits === 'number') {
        setRemaining(parsed.remainingCredits);
      }
    } catch {
      // ignore
    }
  }, []);

  if (dismissed) return null;
  // If cookie not found yet, still show a generic prompt to sign in (optional UX for discovery)
  if (remaining === null) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
          <div className="flex-1">
            <span>
              You&apos;re using a guest session.{' '}
              <Link
                href="/login"
                className="text-amber-700 dark:text-amber-300 underline font-medium hover:no-underline"
              >
                Sign in to reset limits and save chats
              </Link>
            </span>
          </div>
          <button
            className="h-6 w-6 p-0 rounded hover:bg-transparent"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  const isAtLimit = remaining <= 0;

  return (
    <div className={className}>
      <div
        className={
          'flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm ' +
          (isAtLimit
            ? 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200'
            : 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200')
        }
      >
        <div className="flex-1">
          {isAtLimit ? (
            <span>
              You&apos;ve reached your credit limit.{' '}
              <Link
                href="/login"
                className="text-red-700 dark:text-red-300 underline font-medium hover:no-underline"
              >
                Sign in to reset your limits
              </Link>
            </span>
          ) : (
            <span>
              You only have <strong>{remaining}</strong> credit
              {remaining !== 1 ? 's' : ''} left.{' '}
              <Link
                href="/login"
                className="text-amber-700 dark:text-amber-300 underline font-medium hover:no-underline"
              >
                Sign in to reset your limits
              </Link>
            </span>
          )}
        </div>
        <button
          className="h-6 w-6 p-0 rounded hover:bg-transparent"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}


