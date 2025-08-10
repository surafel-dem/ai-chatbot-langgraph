import { Suspense } from 'react';

export default async function ReliabilityRunPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Tasks</h2>
        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
          Streaming tasks will appear here.
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Final Report</h2>
        <Suspense fallback={<div className="rounded-lg border p-3">Loading…</div>}>
          <div className="prose dark:prose-invert rounded-lg border p-3">
            Report will render here when available.
          </div>
        </Suspense>
      </div>
    </div>
  );
}


