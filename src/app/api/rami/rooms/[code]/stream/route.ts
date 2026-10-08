import { normalizeRoomCode } from '@/server/codes';
import { ramiStore, type RamiServerMessage, type RamiSubscriber } from '@/server/ramiStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Plafond de la plateforme pour une fonction : au-delà, elle est tuée net. */
export const maxDuration = 60;

const HEARTBEAT_MS = 20000;

/**
 * Durée de vie volontaire d'un flux.
 *
 * L'hébergeur coupe les fonctions longues sans prévenir, et une coupure
 * brutale laisse le navigateur en erreur. On referme donc nous-mêmes, bien
 * avant la limite : le navigateur rouvre aussitôt, la partie ne s'en aperçoit
 * pas, et la salle reste chaude dans l'instance qui répond.
 */
const STREAM_MAX_MS = 45000;

/**
 * Flux temps réel (SSE). Chaque abonné reçoit une vue *personnalisée* : sa main
 * et rien d'autre. Le serveur reste seul détenteur de l'état complet, pioche
 * comprise.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await ramiStore.findRoom(normalizeRoomCode(code));
  if (!room) return new Response('room not found', { status: 404 });

  const token = new URL(request.url).searchParams.get('token');
  const playerId = ramiStore.playerIdForToken(room, token);

  const encoder = new TextEncoder();
  let subscriber: RamiSubscriber | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lifetime: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: RamiServerMessage) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch {
          closed = true;
        }
      };

      subscriber = { id: crypto.randomUUID(), playerId, send };

      // Désactive la mise en tampon des proxys : les événements arrivent aussitôt.
      controller.enqueue(encoder.encode(': connecté\n\n'));
      ramiStore.attach(room, subscriber);

      heartbeat = setInterval(() => send({ type: 'ping', at: Date.now() }), HEARTBEAT_MS);
      heartbeat.unref?.();

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        if (subscriber) ramiStore.detach(room, subscriber);
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      };

      lifetime = setTimeout(cleanup, STREAM_MAX_MS);
      lifetime.unref?.();

      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
      if (subscriber) ramiStore.detach(room, subscriber);
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
