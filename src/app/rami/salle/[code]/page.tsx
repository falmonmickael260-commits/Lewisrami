import { notFound } from 'next/navigation';
import { RamiRoomScreen } from '@/components/rami/RamiRoomScreen';
import { normalizeRoomCode } from '@/lib/roomCode';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = normalizeRoomCode(code);
  if (normalized.length < 4) notFound();
  return <RamiRoomScreen code={normalized} />;
}
