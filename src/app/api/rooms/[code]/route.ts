import { normalizeRoomCode } from '@/server/codes';
import { findRoom } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sonde publique : existence de la salle et possibilité de la rejoindre. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await findRoom(normalizeRoomCode(code));
  if (!room) return Response.json({ exists: false }, { status: 404 });

  return Response.json({
    exists: true,
    code: room.code,
    phase: room.state.phase,
    playerCount: room.state.players.length,
    joinable: room.state.phase === 'lobby' && room.state.players.length < 8,
  });
}
