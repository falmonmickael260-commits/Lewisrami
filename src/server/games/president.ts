/**
 * Adaptateur du Président pour le store de salles générique.
 * Il ne fait que brancher le moteur existant : aucune règle ne vit ici.
 */

import { decideBotAction } from '@/game/bot';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  addPlayer,
  createGame,
  nextDeadline,
  reduce,
  removePlayer,
  setConnected,
} from '@/game/engine';
import type { GameAction, GameEvent, GameState } from '@/game/types';
import { buildPlayerView, type PlayerView } from '@/game/view';
import { sanitizeSettings } from '@/server/input';
import { redactEvent } from '@/server/protocol';
import type { GameAdapter } from '@/server/roomStore';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export const presidentAdapter: GameAdapter<GameState, GameAction, GameEvent, PlayerView> = {
  key: 'president',
  label: 'Le Président',

  createGame: (settings) =>
    createGame({ settings: (settings ?? {}) as Partial<GameState['settings']> }),
  addPlayer: (state, player) =>
    addPlayer(state, { ...player, avatar: player.avatar, isBot: player.isBot ?? false }),
  removePlayer,
  setConnected,

  reduce,
  tickAction: { type: 'tick' },
  nextDeadline,

  buildView: buildPlayerView,
  redactEvent,

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
  capacity: () => MAX_PLAYERS,

  joinability: (state) => {
    if (state.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
    if (state.players.length >= MAX_PLAYERS) {
      return { ok: false, error: `La table est complète (${MAX_PLAYERS} joueurs).` };
    }
    return { ok: true };
  },
  canStart: (state) => state.phase === 'lobby' && state.players.length >= MIN_PLAYERS,

  applySettings: (state, raw) => {
    const settings = sanitizeSettings(raw);
    return {
      state: {
        ...state,
        version: state.version + 1,
        settings: {
          turnSeconds: clamp(settings.turnSeconds ?? state.settings.turnSeconds, 10, 120),
          rounds: clamp(settings.rounds ?? state.settings.rounds, 1, 10),
          allowEqualRank: settings.allowEqualRank ?? state.settings.allowEqualRank,
        },
      },
      error: null,
    };
  },

  decideBot: decideBotAction,
  botPendingPlayerId: (state) => {
    if (state.phase === 'playing' && state.currentPlayerId) {
      const current = state.players.find((player) => player.id === state.currentPlayerId);
      if (current?.isBot) return current.id;
    }
    if (state.phase === 'exchange' && state.exchange) {
      const pending = state.exchange.transfers.find(
        (transfer) => transfer.cardIds === null && transfer.mode === 'choice',
      );
      const donor = pending && state.players.find((player) => player.id === pending.fromId);
      if (donor?.isBot) return donor.id;
    }
    return null;
  },
  botNames: ['Ada', 'Bolt', 'Cléo', 'Dune', 'Écho', 'Faro', 'Gus', 'Hex'],
  botAvatars: ['🤖', '👾', '🦾', '🛸', '🧿', '🎲', '🪐', '⚡'],
};
