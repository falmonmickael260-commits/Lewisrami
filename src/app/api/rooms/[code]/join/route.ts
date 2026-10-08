import { buildPlayerView } from '@/game/view';
import { normalizeRoomCode } from '@/server/codes';
import { jsonError, readJson, sanitizeAvatar, sanitizeName } from '@/server/input';
import { findRoom, flush, joinRoom } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await findRoom(normalizeRoomCode(code));
  if (!room) return jsonError("Cette salle n'existe pas ou a expiré.", 404);

  const body = await readJson(request);
  const name = sanitizeName(body.name);
  if (!name) return jsonError('Choisissez un pseudo de 2 à 16 caractères.', 400);

  const joined = joinRoom(room, name, sanitizeAvatar(body.avatar));
  if (!joined.ok) return jsonError(joined.error, 409);

  // La salle doit être écrite avant la réponse : sinon, sur un hébergeur sans
  // serveur, la requête suivante ne la retrouverait pas.
  await flush(room);

  return Response.json({
    code: room.code,
    token: joined.token,
    playerId: joined.playerId,
    view: buildPlayerView(room.state, joined.playerId, Date.now()),
  });
}
