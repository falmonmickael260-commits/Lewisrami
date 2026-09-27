import { normalizeRoomCode } from '@/server/codes';
import { jsonError, readJson, sanitizeAvatar, sanitizeName } from '@/server/input';
import { ramiStore } from '@/server/ramiStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await ramiStore.findRoom(normalizeRoomCode(code));
  if (!room) return jsonError("Cette salle n'existe pas ou a expiré.", 404);

  const body = await readJson(request);
  const name = sanitizeName(body.name);
  if (!name) return jsonError('Choisissez un pseudo de 2 à 16 caractères.', 400);

  const joined = ramiStore.joinRoom(room, name, sanitizeAvatar(body.avatar));
  if (!joined.ok) return jsonError(joined.error, 409);

  return Response.json({
    code: room.code,
    token: joined.token,
    playerId: joined.playerId,
    view: ramiStore.buildView(room, joined.playerId),
  });
}
