/**
 * SSE API Route: GET /api/agent-events
 *
 * Streams agent lifecycle notification events to connected web UI clients
 * via Server-Sent Events (SSE).
 *
 * Business logic (polling, delta detection, event mapping) lives in
 * PollAgentEventsUseCase. This route is a thin SSE transport adapter:
 * - Creates a per-connection use case instance
 * - Sets up the SSE stream
 * - Calls useCase.execute() on each poll interval
 * - Formats returned events as SSE messages
 * - Handles heartbeat + cleanup
 */

import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { PollAgentEventsUseCase } from '@shepai/core/application/use-cases/notifications/poll-agent-events.use-case';

// Force dynamic — SSE streams must never be statically optimized or cached
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

export function GET(request: Request): Response {
  try {
    const url = new URL(request.url);
    const runIdFilter = url.searchParams.get('runId');

    // Each SSE connection gets its own use case instance with fresh caches
    const useCase = resolve<PollAgentEventsUseCase>('PollAgentEventsUseCase');

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let stopped = false;
        let pollErrorCount = 0;

        function enqueue(text: string) {
          if (stopped) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            // Stream may be closed
          }
        }

        async function poll() {
          if (stopped) return;

          try {
            const events = await useCase.execute(runIdFilter);

            for (const item of events) {
              if (item.kind === 'notification') {
                // eslint-disable-next-line no-console
                console.log(
                  `[SSE] emit: ${item.event.eventType} for "${item.event.featureName}"${item.event.phaseName ? ` (${item.event.phaseName})` : ''}`
                );
                enqueue(`event: notification\ndata: ${JSON.stringify(item.event)}\n\n`);
              } else {
                enqueue(`event: interactive_session\ndata: ${JSON.stringify(item.event)}\n\n`);
              }
            }

            pollErrorCount = 0; // Reset on success
          } catch (error) {
            pollErrorCount++;
            // Log first few errors, then throttle to avoid spamming
            if (pollErrorCount <= 3 || pollErrorCount % 60 === 0) {
              // eslint-disable-next-line no-console
              console.error(
                `[SSE /api/agent-events] poll error #${pollErrorCount}:`,
                error instanceof Error ? error.message : error
              );
            }
          }
        }

        // First poll immediately, then every POLL_INTERVAL_MS
        void poll();
        const pollInterval = setInterval(() => void poll(), POLL_INTERVAL_MS);

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          enqueue(': heartbeat\n\n');
        }, HEARTBEAT_INTERVAL_MS);

        // Cleanup on client disconnect
        const cleanup = () => {
          stopped = true;
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          try {
            controller.close();
          } catch {
            // Stream may already be closed
          }
        };

        request.signal.addEventListener('abort', cleanup, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
