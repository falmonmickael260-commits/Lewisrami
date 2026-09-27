/**
 * Store des salles du Président.
 *
 * Toute la plomberie — jetons, abonnés, chrono, bots, présence, persistance —
 * vit désormais dans `roomStore.ts`, partagée avec le Rami. Ce fichier ne fait
 * que l'instancier avec l'adaptateur du Président et conserver les noms
 * historiquement importés par les routes.
 */

import { presidentAdapter } from './games/president';
import { createRoomStore, type Room as GenericRoom, type Subscriber as GenericSubscriber } from './roomStore';
import type { GameAction, GameEvent, GameState } from '@/game/types';
import type { PlayerView } from '@/game/view';

const store = createRoomStore(presidentAdapter);

export type Room = GenericRoom<GameState, PlayerView, GameEvent>;
export type Subscriber = GenericSubscriber<PlayerView, GameEvent>;
export type { JoinFailure, JoinOutcome } from './roomStore';

export const createRoom = store.createRoom;
export const findRoom = store.findRoom;
export const playerIdForToken = store.playerIdForToken;
export const broadcast = store.broadcast;
export const commit = store.commit;
export const joinRoom = store.joinRoom;
export const addBot = store.addBot;
export const kickPlayer = store.kickPlayer;
export const leaveRoom = store.leaveRoom;
export const updateSettings = store.updateSettings;
export const canStart = store.canStart;
export const attach = store.attach;
export const detach = store.detach;
export const probe = store.probe;

export function dispatch(room: Room, action: GameAction): GameEvent[] {
  return store.dispatch(room, action);
}
