import { jsonError, readJson, sanitizeAvatar, sanitizeName, sanitizeRamiSettings } from '@/server/input';
import { ramiStore } from '@/server/ramiStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Crée une salle de Rami et y installe son hôte. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const name = sanitizeName(body.name);
  if (!name) return jsonError('Choisissez un pseudo de 2 à 16 caractères.', 400);

  const room = ramiStore.createRoom(sanitizeRamiSettings(body.settings));
  const joined = ramiStore.joinRoom(room, name, sanitizeAvatar(body.avatar));
  if (!joined.ok) return jsonError(joined.error, 409);

  return Response.json({
    code: room.code,
    token: joined.token,
    playerId: joined.playerId,
    view: ramiStore.buildView(room, joined.playerId),
  });
}
