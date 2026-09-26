import { normalizeRoomCode } from '@/server/codes';
import type { ServerMessage } from '@/server/protocol';
import { attach, detach, findRoom, playerIdForToken, type Subscriber } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 20000;

/**
 * Flux temps réel (SSE). Chaque abonné reçoit une vue *personnalisée* :
 * sa main et rien d'autre. Le serveur reste seul détenteur de l'état complet.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await findRoom(normalizeRoomCode(code));
  if (!room) {
    return new Response('room not found', { status: 404 });
  }

  const token = new URL(request.url).searchParams.get('token');
  const playerId = playerIdForToken(room, token);

  const encoder = new TextEncoder();
  let subscriber: Subscriber | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: ServerMessage) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch {
          closed = true;
        }
      };

      subscriber = { id: crypto.randomUUID(), playerId, send };

      // Désactive la mise en tampon des proxys pour que les événements arrivent immédiatement.
      controller.enqueue(encoder.encode(': connecté\n\n'));
      attach(room, subscriber);

      heartbeat = setInterval(() => send({ type: 'ping', at: Date.now() }), HEARTBEAT_MS);
      heartbeat.unref?.();

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (subscriber) detach(room, subscriber);
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (subscriber) detach(room, subscriber);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
