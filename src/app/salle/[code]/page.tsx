import type { Metadata } from 'next';
import { RoomScreen } from '@/components/room/RoomScreen';
import { normalizeRoomCode } from '@/lib/roomCode';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const normalized = normalizeRoomCode(code);
  return {
    title: `Salle ${normalized} — Le Président`,
    description: `Rejoignez la partie ${normalized} du Président.`,
  };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomScreen code={normalizeRoomCode(code)} />;
}
