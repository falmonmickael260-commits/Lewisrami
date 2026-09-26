import type { GameEvent, StampedEvent } from '@/game/types';
import type { PlayerView } from '@/game/view';

/** Message poussé sur le flux temps réel. */
export type ServerMessage =
  | { type: 'sync'; view: PlayerView; events: StampedEvent[]; seq: number }
  | { type: 'error'; message: string }
  | { type: 'ping'; at: number }
  | { type: 'closed'; reason: string };

export interface JoinResponse {
  code: string;
  token: string;
  playerId: string;
  view: PlayerView;
}

/** Retire des événements toute information privée avant diffusion à un joueur. */
export function redactEvent(event: GameEvent, viewerId: string | null): GameEvent {
  if (event.type === 'exchange_transfer') {
    const visible = viewerId === event.fromId || viewerId === event.toId;
    return visible ? event : { ...event, cardIds: [] };
  }
  return event;
}
