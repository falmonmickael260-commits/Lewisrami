'use client';

import type { GameEvent, StampedEvent } from '@/game/types';
import type { PlayerView } from '@/game/view';
import { useGameRoom, type ConnectionStatus, type GameRoomHandle } from './useGameRoom';
import { saveSession } from '@/lib/session';

export type { ConnectionStatus };

export interface RoomHandle extends Omit<GameRoomHandle<PlayerView, GameEvent>, 'events'> {
  events: StampedEvent[];
}

/**
 * Connexion temps réel à une salle du Président.
 * Toute la mécanique vit dans `useGameRoom`, partagée avec le Rami.
 */
export function useRoom(code: string): RoomHandle {
  return useGameRoom<PlayerView, GameEvent>(code, '/api/rooms', 'president');
}

export { saveSession };
