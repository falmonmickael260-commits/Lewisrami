import { normalizeRoomCode } from '@/server/codes';
import { ramiStore } from '@/server/ramiStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sonde publique : existence de la salle, mode et possibilité de la rejoindre. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await ramiStore.findRoom(normalizeRoomCode(code));
  if (!room) return Response.json({ exists: false }, { status: 404 });

  return Response.json({
    ...ramiStore.probe(room),
    mode: room.state.settings.mode,
  });
}
