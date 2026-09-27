/** Store des salles de Rami. Toute la plomberie vit dans `roomStore.ts`. */

import { ramiAdapter } from './games/rami';
import { createRoomStore, type Room, type ServerMessage, type Subscriber } from './roomStore';
import type { RamiAction, RamiEvent, RamiState } from '@/rami/types';
import type { RamiPlayerView } from '@/rami/view';

export const ramiStore = createRoomStore(ramiAdapter);

export type RamiRoom = Room<RamiState, RamiPlayerView, RamiEvent>;
export type RamiSubscriber = Subscriber<RamiPlayerView, RamiEvent>;
export type RamiServerMessage = ServerMessage<RamiPlayerView, RamiEvent>;
export type { RamiAction };
