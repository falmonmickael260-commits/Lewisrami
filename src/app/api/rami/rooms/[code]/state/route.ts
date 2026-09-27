import { normalizeRoomCode } from '@/server/codes';
import { jsonError } from '@/server/input';
import { ramiStore } from '@/server/ramiStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Instantané de la vue d'un joueur.
 * Filet de sécurité quand le flux temps réel est indisponible (proxy filtrant
 * le SSE, onglet réveillé après une longue veille).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await ramiStore.findRoom(normalizeRoomCode(code));
  if (!room) return jsonError("Cette salle n'existe pas ou a expiré.", 404);

  const token = new URL(request.url).searchParams.get('token');
  const playerId = ramiStore.playerIdForToken(room, token);
  return Response.json({ view: ramiStore.buildView(room, playerId) });
}
