/**
 * Adaptateur du Rami pour le store de salles générique.
 * Il ne fait que brancher le moteur de `src/rami/` : aucune règle ne vit ici.
 */

import { botPendingPlayerId, decideBotAction } from '@/rami/bot';
import {
  addPlayer,
  canStart,
  createGame,
  nextDeadline,
  reduce,
  removePlayer,
  requiredPlayers,
  setConnected,
  setMode,
  setTurnSeconds,
} from '@/rami/engine';
import { MODE_LABELS } from '@/rami/scoring';
import type { GameMode, RamiAction, RamiEvent, RamiState } from '@/rami/types';
import { buildRamiView, redactRamiEvent, type RamiPlayerView } from '@/rami/view';
import { sanitizeRamiSettings } from '@/server/input';
import type { GameAdapter } from '@/server/roomStore';

export const ramiAdapter: GameAdapter<RamiState, RamiAction, RamiEvent, RamiPlayerView> = {
  key: 'rami',
  label: 'Rami',

  createGame: (settings) =>
    createGame({ settings: sanitizeRamiSettings(settings) }),
  addPlayer,
  removePlayer,
  setConnected,

  reduce,
  tickAction: { type: 'tick' },
  nextDeadline,

  buildView: buildRamiView,
  redactEvent: redactRamiEvent,

  players: (state) =>
    state.players.map((player) => ({
      id: player.id,
      isBot: player.isBot,
      isHost: player.isHost,
      connected: player.connected,
    })),
  version: (state) => state.version,
  phase: (state) => state.phase,
  isLobby: (state) => state.phase === 'lobby',
  capacity: (state) => requiredPlayers(state.settings.mode),

  joinability: (state) => {
    if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
    const limit = requiredPlayers(state.settings.mode);
    if (state.players.length >= limit) {
      return {
        ok: false,
        error: `La table est complète : le mode ${MODE_LABELS[state.settings.mode]} se joue à ${limit}.`,
      };
    }
    return { ok: true };
  },
  canStart,

  applySettings: (state, raw) => {
    const settings = sanitizeRamiSettings(raw);
    let next = state;

    if (settings.mode && settings.mode !== state.settings.mode) {
      // Changer de mode peut libérer des places : on refuse si des joueurs
      // devraient être expulsés sans l'avoir demandé.
      const limit = requiredPlayers(settings.mode as GameMode);
      if (state.players.length > limit) {
        return {
          state,
          error: `Le mode ${MODE_LABELS[settings.mode as GameMode]} se joue à ${limit} joueurs : retirez d’abord les joueurs en trop.`,
        };
      }
      next = setMode(next, settings.mode as GameMode);
    }

    if (settings.turnSeconds !== undefined) {
      next = setTurnSeconds(next, settings.turnSeconds);
    }

    return { state: next, error: null };
  },

  decideBot: decideBotAction,
  botPendingPlayerId,
  botNames: ['Ada', 'Bolt', 'Cléo', 'Dune'],
  botAvatars: ['🤖', '👾', '🦾', '🛸'],
};
