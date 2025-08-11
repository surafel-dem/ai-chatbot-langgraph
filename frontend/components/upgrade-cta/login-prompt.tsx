'use client';

import Link from 'next/link';

interface LoginPromptProps {
  title: string;
  description: string;
  className?: string;
}

export function LoginPrompt({ title, description, className }: LoginPromptProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <h4 className="font-medium text-sm">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      <Link href="/login" className="text-sm font-medium text-blue-500 hover:underline mt-2 inline-block">
        Sign in
      </Link>
    </div>
  );
}


