import { createDataStreamResponse, createUIMessageStream } from 'ai';
import { cookies } from 'next/headers';
import { api } from '@/convex/_generated/api';
import { createAuthenticatedClient, createGuestClient } from '@/lib/convex-client';
import { ANONYMOUS_SESSION_COOKIES_KEY } from '@/lib/constants';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { runId, chatId, car } = await req.json();

  return createDataStreamResponse(async (stream) => {
    const ui = createUIMessageStream(stream);
    const ac = new AbortController();
    req.signal.addEventListener('abort', () => ac.abort());

    // Credits: deduct for guests (simple cookie check)
    try {
      const cookieStore = await cookies();
      const anon = cookieStore.get(ANONYMOUS_SESSION_COOKIES_KEY)?.value;
      if (anon) {
        const session = JSON.parse(anon);
        if ((session.remainingCredits ?? 0) <= 0) {
          ui.writeData({ type: 'text-delta', textDelta: 'You have reached your free run limit. Please sign in.' });
          ui.done();
          return;
        }
        session.remainingCredits = Math.max(0, (session.remainingCredits ?? 0) - 5);
        cookieStore.set(ANONYMOUS_SESSION_COOKIES_KEY, JSON.stringify(session), { path: '/', sameSite: 'lax' });
      }
    } catch {}

    // Persist start event
    let convex;
    try {
      convex = await createAuthenticatedClient();
    } catch {
      convex = createGuestClient();
    }

    await convex.mutation(api.steps.startStep, { run_id: runId, role: 'specialist', name: 'reliability' });

    // Stream stubbed tasks now; real implementation will call tools and prompts
    ui.writeData({ type: 'task-start', id: 'confirmCar', title: 'Confirm car' });
    ui.writeData({ type: 'task-update', id: 'confirmCar', items: [{ type: 'text', text: `Analyzing ${car?.year ?? ''} ${car?.make ?? ''} ${car?.model ?? ''}` }] });
    ui.writeData({ type: 'task-finish', id: 'confirmCar', summary: 'Car confirmed.' });

    ui.writeData({ type: 'task-start', id: 'problems', title: 'Common problems' });
    ui.writeData({ type: 'task-update', id: 'problems', items: [{ type: 'text', text: 'Fetching owner-reported issues…' }] });
    ui.writeData({ type: 'task-finish', id: 'problems', summary: 'Problems collected.' });

    ui.writeData({ type: 'task-start', id: 'recalls', title: 'Recall history' });
    ui.writeData({ type: 'task-finish', id: 'recalls', summary: 'Recalls summarized.' });

    ui.writeData({ type: 'task-start', id: 'maintenance', title: 'Maintenance & longevity' });
    ui.writeData({ type: 'task-finish', id: 'maintenance', summary: 'Maintenance tips drafted.' });

    ui.writeData({
      type: 'final-report',
      reportMarkdown: `# Reliability Report\n\n(Placeholder) Final report for ${car?.year ?? ''} ${car?.make ?? ''} ${car?.model ?? ''}.`,
      scores: { engine: 7, electrical: 7, body: 8, recalls: 6, tco: 7 },
      sources: [],
    });

    ui.done();
  });
}


