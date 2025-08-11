'use client';
import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/use-mounted';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export function WithSkeleton({
  children,
  className,
  isLoading,
  ...props
}: React.ComponentProps<'div'> & {
  isLoading?: boolean;
}) {
  const mounted = useMounted();

  return (
    <div className={cn('relative w-fit', className)} {...props}>
      {children}

      {(!mounted || isLoading) && (
        <>
          <div className={cn('absolute inset-0 bg-background', className)} />

          <Skeleton className={cn('absolute inset-0', className)} />
        </>
      )}
    </div>
  );
}
