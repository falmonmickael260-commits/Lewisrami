/**
 * Machine d'état du Rami.
 *
 * Elle est **pure** : `reduce(state, action)` renvoie un nouvel état et la liste
 * des événements à animer, sans jamais toucher au réseau, au DOM ni à l'horloge
 * globale (le temps est toujours passé en paramètre). C'est ce qui permet de
 * rejouer une partie entière dans un test.
 *
 * Déroulement d'une manche :
 *
 * ```
 * DISTRIBUTION (14 cartes, 15 au donneur)
 *        ↓
 *   TOUR DU DONNEUR ────► il ne pioche pas, il jette sa 15ᵉ carte
 *        ↓
 *   TOUR SUIVANT : pioche | reprise ─► poses (facultatif) ─► défausse (obligatoire)
 *        ↓
 *   MAIN VIDE APRÈS DÉFAUSSE ─► FIN DE MANCHE ─► nouvelle manche ou FIN DE PARTIE
 * ```
 */

import { createRng, nextSeed, shuffle } from '@/game/rng';
import {
  DEALER_HAND_SIZE,
  HAND_SIZE,
  createDeck,
  sortHand,
} from './cards';
import { jokerCountOf } from './melds';
import {
  validateCancelTake,
  validateDiscard,
  validateDrawStock,
  validateExtend,
  validateLayMelds,
  validateReclaim,
  validateTakeDiscard,
  findPlayer,
} from './moves';
import {
  OPENING_THRESHOLD,
  PLAYERS_BY_MODE,
  TARGET_BY_MODE,
  buildRoundSummary,
  teamCount,
  teamOfSeat,
  winnerTeamOf,
} from './scoring';
import type {
  CardId,
  GameMode,
  Meld,
  MeldProposal,
  RamiAction,
  RamiCard,
  RamiEvent,
  RamiPlayer,
  RamiSettings,
  RamiState,
  Team,
  TurnState,
} from './types';

/** Durée de l'animation de distribution : la table reste verrouillée. */
export const DEAL_MS = 2900;
/** Durée de l'écran de fin de manche avant la manche suivante. */
export const ROUND_END_MS = 16000;
/** Un joueur déconnecté ne bloque pas la table : son tour expire plus vite. */
export const DISCONNECTED_TURN_MS = 8000;

export const DEFAULT_MODE: GameMode = '2v2';

export function settingsFor(mode: GameMode, turnSeconds = 45): RamiSettings {
  return {
    mode,
    turnSeconds,
    targetScore: TARGET_BY_MODE[mode],
    openingThreshold: OPENING_THRESHOLD,
  };
}

export function requiredPlayers(mode: GameMode): number {
  return PLAYERS_BY_MODE[mode];
}

export interface ReduceResult {
  state: RamiState;
  events: RamiEvent[];
}

function bump(state: RamiState): RamiState {
  return { ...state, version: state.version + 1 };
}

/* ------------------------------------------------------------------ */
/* Création et salon                                                   */
/* ------------------------------------------------------------------ */

export function createGame(options?: {
  settings?: Partial<RamiSettings> & { mode?: GameMode };
  seed?: number;
  now?: number;
}): RamiState {
  const mode = options?.settings?.mode ?? DEFAULT_MODE;
  const base = settingsFor(mode, options?.settings?.turnSeconds ?? 45);
  const state: RamiState = {
    phase: 'lobby',
    settings: base,
    roundNumber: 0,
    players: [],
    teams: [],
    stock: [],
    discard: [],
    melds: [],
    dealerId: null,
    currentPlayerId: null,
    turn: null,
    turnDeadline: null,
    turnTotalMs: null,
    phaseEndsAt: null,
    version: 0,
    seed: options?.seed ?? ((Date.now() & 0x7fffffff) || 1),
    recycles: 0,
    lastSummary: null,
    outcome: null,
    createdAt: options?.now ?? Date.now(),
  };
  return syncTeams(state);
}

/**
 * Aligne la liste des équipes sur le mode et les sièges.
 * En 2 vs 2 les partenaires sont face à face (sièges pairs contre impairs).
 */
export function syncTeams(state: RamiState): RamiState {
  const count = teamCount(state.settings.mode);
  const teams: Team[] = [];
  for (let id = 0; id < count; id++) {
    const existing = state.teams.find((team) => team.id === id);
    teams.push(
      existing ?? { id, score: 0, opening: { opened: false, score: 0, byId: null } },
    );
  }
  const players = state.players.map((player) => ({
    ...player,
    teamId: teamOfSeat(player.seat, state.settings.mode),
  }));
  return { ...state, teams, players };
}

export function addPlayer(
  state: RamiState,
  player: { id: string; name: string; avatar: string; isBot?: boolean },
): RamiState {
  if (state.phase !== 'lobby') return state;
  if (state.players.length >= requiredPlayers(state.settings.mode)) return state;
  if (state.players.some((entry) => entry.id === player.id)) return state;

  const seat = state.players.length;
  const next: RamiPlayer = {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    seat,
    teamId: teamOfSeat(seat, state.settings.mode),
    isHost: state.players.length === 0,
    isBot: player.isBot ?? false,
    connected: true,
    hand: [],
    hasEntered: false,
    score: 0,
  };
  return bump(syncTeams({ ...state, players: [...state.players, next] }));
}

export function removePlayer(state: RamiState, playerId: string): RamiState {
  const players = state.players
    .filter((player) => player.id !== playerId)
    .map((player, index) => ({ ...player, seat: index }));
  if (players.length > 0 && !players.some((player) => player.isHost)) {
    players[0] = { ...players[0], isHost: true };
  }
  return bump(syncTeams({ ...state, players }));
}

export function setConnected(
  state: RamiState,
  playerId: string,
  connected: boolean,
): RamiState {
  if (!state.players.some((p) => p.id === playerId && p.connected !== connected)) {
    return state;
  }
  return bump({
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, connected } : player,
    ),
  });
}

/**
 * Change le mode de jeu. Le nombre de joueurs attendu et la cible en découlent,
 * et les places excédentaires sont libérées.
 */
export function setMode(state: RamiState, mode: GameMode): RamiState {
  if (state.phase !== 'lobby') return state;
  const limit = requiredPlayers(mode);
  const players = state.players.slice(0, limit);
  return bump(
    syncTeams({
      ...state,
      settings: settingsFor(mode, state.settings.turnSeconds),
      players,
      teams: [],
    }),
  );
}

export function setTurnSeconds(state: RamiState, turnSeconds: number): RamiState {
  if (state.phase !== 'lobby') return state;
  return bump({
    ...state,
    settings: { ...state.settings, turnSeconds: clamp(turnSeconds, 15, 180) },
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function canStart(state: RamiState): boolean {
  return (
    state.phase === 'lobby' &&
    state.players.length === requiredPlayers(state.settings.mode)
  );
}

/* ------------------------------------------------------------------ */
/* Distribution                                                        */
/* ------------------------------------------------------------------ */

function bySeat(players: readonly RamiPlayer[]): RamiPlayer[] {
  return players.slice().sort((a, b) => a.seat - b.seat);
}

/**
 * Distribue une manche : 14 cartes à chacun, 15 au donneur.
 *
 * Le donneur tourne à chaque manche. Il entame avec sa quinzième carte : il ne
 * pioche pas et doit la jeter, ce qui crée la première carte visible de la
 * défausse (règle 8).
 */
export function startRound(state: RamiState, now: number): ReduceResult {
  const players = bySeat(state.players);
  const roundNumber = state.roundNumber + 1;
  const dealerIndex = (roundNumber - 1) % players.length;
  const dealer = players[dealerIndex];

  const rng = createRng(state.seed);
  const deck = shuffle(createDeck(), rng);

  let cursor = 0;
  const dealt = players.map((player) => {
    const size = player.id === dealer.id ? DEALER_HAND_SIZE : HAND_SIZE;
    const hand = deck.slice(cursor, cursor + size);
    cursor += size;
    return { ...player, hand: sortHand(hand), hasEntered: false };
  });

  const stock = deck.slice(cursor);
  const perPlayer: Record<string, number> = {};
  for (const player of dealt) perPlayer[player.id] = player.hand.length;

  const isFirstRound = roundNumber === 1;
  const teams: Team[] = state.teams.map((team) => ({
    id: team.id,
    score: isFirstRound ? 0 : team.score,
    opening: { opened: false, score: 0, byId: null },
  }));

  const turn: TurnState = {
    stage: 'meld',
    drawnFrom: null,
    takenCardId: null,
    takenCardUsed: false,
    meldedThisTurn: false,
    isDealerOpening: true,
  };

  const next: RamiState = {
    ...state,
    phase: 'dealing',
    roundNumber,
    players: dealt.map((player) => ({
      ...player,
      score: isFirstRound ? 0 : player.score,
    })),
    teams,
    stock,
    discard: [],
    melds: [],
    dealerId: dealer.id,
    currentPlayerId: dealer.id,
    turn,
    turnDeadline: null,
    turnTotalMs: null,
    phaseEndsAt: now + DEAL_MS,
    seed: nextSeed(state.seed),
    recycles: 0,
    lastSummary: isFirstRound ? null : state.lastSummary,
    outcome: null,
  };

  const events: RamiEvent[] = [
    { type: 'round_start', roundNumber, dealerId: dealer.id, perPlayer },
  ];
  return { state: bump(next), events };
}

/* ------------------------------------------------------------------ */
/* Tours                                                               */
/* ------------------------------------------------------------------ */

function turnDurationFor(state: RamiState, playerId: string): number {
  const player = findPlayer(state, playerId);
  return player && !player.connected && !player.isBot
    ? DISCONNECTED_TURN_MS
    : state.settings.turnSeconds * 1000;
}

function beginTurn(
  state: RamiState,
  playerId: string,
  now: number,
  events: RamiEvent[],
  options?: { dealerOpening?: boolean },
): RamiState {
  const dealerOpening = options?.dealerOpening ?? false;
  const turn: TurnState = {
    stage: dealerOpening ? 'meld' : 'draw',
    drawnFrom: null,
    takenCardId: null,
    takenCardUsed: false,
    meldedThisTurn: false,
    isDealerOpening: dealerOpening,
  };
  const total = turnDurationFor(state, playerId);
  const deadline = now + total;
  events.push({ type: 'turn', playerId, deadline, stage: turn.stage });
  return {
    ...state,
    currentPlayerId: playerId,
    turn,
    turnDeadline: deadline,
    turnTotalMs: total,
  };
}

function nextPlayerId(state: RamiState, fromId: string): string {
  const ordered = bySeat(state.players);
  const index = ordered.findIndex((player) => player.id === fromId);
  if (index === -1) return ordered[0].id;
  return ordered[(index + 1) % ordered.length].id;
}

/**
 * Recycle la défausse en nouvelle pioche (règle 13).
 *
 * La dernière carte jetée **reste en place**, visible : seules les cartes
 * situées en dessous sont reprises, mélangées, et deviennent la pioche.
 */
function recycleDiscard(state: RamiState, events: RamiEvent[]): RamiState {
  if (state.stock.length > 0) return state;
  if (state.discard.length <= 1) return state;

  const top = state.discard[state.discard.length - 1];
  const buried = state.discard.slice(0, -1);
  const rng = createRng(state.seed);
  const stock = shuffle(buried, rng);

  events.push({ type: 'recycle', count: stock.length });
  return {
    ...state,
    stock,
    discard: [top],
    seed: nextSeed(state.seed),
    recycles: state.recycles + 1,
  };
}

/* ------------------------------------------------------------------ */
/* Mutations de main et de table                                       */
/* ------------------------------------------------------------------ */

function withHand(
  state: RamiState,
  playerId: string,
  change: (hand: RamiCard[]) => RamiCard[],
): RamiState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, hand: sortHand(change(player.hand)) } : player,
    ),
  };
}

function removeFromHand(
  state: RamiState,
  playerId: string,
  ids: readonly CardId[],
): RamiState {
  const doomed = new Set(ids);
  return withHand(state, playerId, (hand) => hand.filter((card) => !doomed.has(card.id)));
}

function markTakenUsed(state: RamiState, usedIds: readonly CardId[]): RamiState {
  const turn = state.turn;
  if (!turn || turn.takenCardId === null || turn.takenCardUsed) return state;
  if (!usedIds.includes(turn.takenCardId)) return state;
  return { ...state, turn: { ...turn, takenCardUsed: true } };
}

function markMelded(state: RamiState): RamiState {
  const turn = state.turn;
  if (!turn) return state;
  return { ...state, turn: { ...turn, meldedThisTurn: true } };
}

function setEntered(state: RamiState, playerId: string): RamiState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, hasEntered: true } : player,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function doDrawStock(state: RamiState, playerId: string): ReduceResult {
  const check = validateDrawStock(state, playerId);
  if (!check.ok) return { state, events: [] };

  const events: RamiEvent[] = [];
  let next = recycleDiscard(state, events);
  const card = next.stock[0];
  if (!card) return { state, events: [] };

  next = { ...next, stock: next.stock.slice(1) };
  next = withHand(next, playerId, (hand) => [...hand, card]);
  next = {
    ...next,
    turn: { ...(next.turn as TurnState), stage: 'meld', drawnFrom: 'stock' },
  };

  events.push({
    type: 'draw',
    playerId,
    from: 'stock',
    card,
    stockLeft: next.stock.length,
  });
  return { state: bump(next), events };
}

function doTakeDiscard(state: RamiState, playerId: string): ReduceResult {
  const check = validateTakeDiscard(state, playerId);
  if (!check.ok) return { state, events: [] };

  const card = check.card;
  let next: RamiState = { ...state, discard: state.discard.slice(0, -1) };
  next = withHand(next, playerId, (hand) => [...hand, card]);
  next = {
    ...next,
    turn: {
      ...(next.turn as TurnState),
      stage: 'meld',
      drawnFrom: 'discard',
      takenCardId: card.id,
      takenCardUsed: false,
    },
  };

  return {
    state: bump(next),
    events: [
      { type: 'draw', playerId, from: 'discard', card, stockLeft: next.stock.length },
    ],
  };
}

function doCancelTake(state: RamiState, playerId: string): ReduceResult {
  const check = validateCancelTake(state, playerId);
  if (!check.ok) return { state, events: [] };

  const card = check.card;
  let next = removeFromHand(state, playerId, [card.id]);
  next = { ...next, discard: [...next.discard, card] };
  next = {
    ...next,
    turn: {
      ...(next.turn as TurnState),
      stage: 'draw',
      drawnFrom: null,
      takenCardId: null,
      takenCardUsed: false,
    },
  };

  return { state: bump(next), events: [{ type: 'take_cancelled', playerId, card }] };
}

function doLayMelds(
  state: RamiState,
  playerId: string,
  proposals: readonly MeldProposal[],
): ReduceResult {
  const check = validateLayMelds(state, playerId, proposals);
  if (!check.ok) return { state, events: [] };

  const player = findPlayer(state, playerId);
  if (!player) return { state, events: [] };

  const melds: Meld[] = check.built.map((built, index) => ({
    id: `m${state.roundNumber}-${state.version}-${index}`,
    kind: built.kind,
    teamId: player.teamId,
    ownerId: playerId,
    suit: built.suit,
    rank: built.rank,
    slots: built.slots,
    roundNumber: state.roundNumber,
  }));

  let next: RamiState = { ...state, melds: [...state.melds, ...melds] };
  next = removeFromHand(next, playerId, check.usedIds);
  next = setEntered(next, playerId);
  next = markTakenUsed(next, check.usedIds);
  next = markMelded(next);

  if (check.isOpening) {
    next = {
      ...next,
      teams: next.teams.map((team) =>
        team.id === player.teamId
          ? { ...team, opening: { opened: true, score: check.points, byId: playerId } }
          : team,
      ),
    };
  }

  return {
    state: bump(next),
    events: [
      {
        type: 'meld_laid',
        playerId,
        teamId: player.teamId,
        meldIds: melds.map((meld) => meld.id),
        points: check.points,
        isOpening: check.isOpening,
      },
    ],
  };
}

function doExtend(
  state: RamiState,
  playerId: string,
  meldId: string,
  cardIds: readonly CardId[],
): ReduceResult {
  const check = validateExtend(state, playerId, meldId, cardIds);
  if (!check.ok) return { state, events: [] };

  const slots = check.slots.map((slot) =>
    slot.byId === '' ? { ...slot, byId: playerId } : slot,
  );

  let next: RamiState = {
    ...state,
    melds: state.melds.map((meld) => (meld.id === meldId ? { ...meld, slots } : meld)),
  };
  next = removeFromHand(next, playerId, cardIds);
  next = markTakenUsed(next, cardIds);
  next = markMelded(next);

  return {
    state: bump(next),
    events: [{ type: 'meld_extended', playerId, meldId, cards: check.cards }],
  };
}

function doReclaim(
  state: RamiState,
  playerId: string,
  meldId: string,
  cardIds: readonly CardId[],
): ReduceResult {
  const check = validateReclaim(state, playerId, meldId, cardIds);
  if (!check.ok) return { state, events: [] };

  const player = findPlayer(state, playerId);
  if (!player) return { state, events: [] };

  const slots = check.slots.map((slot) =>
    slot.byId === '' ? { ...slot, byId: playerId } : slot,
  );

  let next: RamiState = {
    ...state,
    melds: state.melds.map((meld) => (meld.id === meldId ? { ...meld, slots } : meld)),
  };
  next = removeFromHand(next, playerId, cardIds);
  next = withHand(next, playerId, (hand) => [...hand, check.joker]);
  next = markTakenUsed(next, cardIds);
  next = markMelded(next);

  return {
    state: bump(next),
    events: [
      {
        type: 'joker_reclaimed',
        playerId,
        meldId,
        joker: check.joker,
        replacedBy: check.cards,
        fromOpponent: check.meld.teamId !== player.teamId,
      },
    ],
  };
}

function doDiscard(
  state: RamiState,
  playerId: string,
  cardId: CardId,
  now: number,
): ReduceResult {
  const check = validateDiscard(state, playerId, cardId);
  if (!check.ok) return { state, events: [] };

  const events: RamiEvent[] = [];
  let next = removeFromHand(state, playerId, [cardId]);
  next = { ...next, discard: [...next.discard, check.card] };

  const player = findPlayer(next, playerId);
  events.push({
    type: 'discard',
    playerId,
    card: check.card,
    handLeft: player?.hand.length ?? 0,
  });

  if (check.finishes) {
    return endRound(next, playerId, now, events);
  }

  // La pioche vide se recycle immédiatement : la carte qui vient d'être jetée
  // reste la carte visible, et le joueur suivant retrouve une pioche garnie.
  next = recycleDiscard(next, events);

  if (next.stock.length === 0 && next.discard.length <= 1) {
    // Cas limite : plus rien à piocher et rien à recycler. La manche s'arrête
    // sans gagnant, chacun compte ses cartes.
    return endRound(next, null, now, events);
  }

  next = beginTurn(next, nextPlayerId(next, playerId), now, events);
  return { state: bump(next), events };
}

/* ------------------------------------------------------------------ */
/* Fin de manche et de partie                                          */
/* ------------------------------------------------------------------ */

function endRound(
  state: RamiState,
  winnerId: string | null,
  now: number,
  events: RamiEvent[],
): ReduceResult {
  const summary = buildRoundSummary(state, winnerId);

  const pointsByPlayer = new Map(summary.players.map((line) => [line.playerId, line.points]));
  const totalByTeam = new Map(summary.teams.map((line) => [line.teamId, line.total]));

  const players = state.players.map((player) => ({
    ...player,
    score: player.score + (pointsByPlayer.get(player.id) ?? 0),
  }));
  const teams = state.teams.map((team) => ({
    ...team,
    score: totalByTeam.get(team.id) ?? team.score,
  }));

  const isOver = summary.bustedTeamIds.length > 0;

  const next: RamiState = {
    ...state,
    phase: isOver ? 'game_over' : 'round_end',
    players,
    teams,
    currentPlayerId: null,
    turn: null,
    turnDeadline: null,
    turnTotalMs: null,
    phaseEndsAt: isOver ? null : now + ROUND_END_MS,
    lastSummary: summary,
    outcome: isOver
      ? {
          loserTeamIds: summary.bustedTeamIds,
          winnerTeamId: winnerTeamOf(summary.teams),
          rounds: state.roundNumber,
        }
      : null,
  };

  events.push({ type: 'round_end', summary });
  if (next.outcome) events.push({ type: 'game_over', outcome: next.outcome });

  return { state: bump(next), events };
}

/* ------------------------------------------------------------------ */
/* Coup automatique à l'expiration du chrono                           */
/* ------------------------------------------------------------------ */

/**
 * Action par défaut quand le temps d'un joueur expire.
 *
 * On ne triche jamais à sa place : on pioche, puis on jette la carte la moins
 * utile. Si une carte a été reprise dans la défausse sans être utilisée, elle
 * est d'abord remise en place — sinon le tour serait impossible à terminer.
 */
export function autoActionFor(state: RamiState, playerId: string): RamiAction | null {
  const player = findPlayer(state, playerId);
  const turn = state.turn;
  if (!player || !turn || state.currentPlayerId !== playerId) return null;

  if (turn.takenCardId !== null && !turn.takenCardUsed) {
    return { type: 'cancel_take', playerId };
  }
  if (turn.stage === 'draw') {
    return { type: 'draw_stock', playerId };
  }
  const card = leastUsefulCard(player.hand);
  return card ? { type: 'discard', playerId, cardId: card.id } : null;
}

/**
 * Carte la moins utile d'une main : on garde les jokers et les cartes qui
 * participent à une amorce de combinaison, on jette la plus chère des isolées.
 */
export function leastUsefulCard(hand: readonly RamiCard[]): RamiCard | null {
  if (hand.length === 0) return null;
  const pips = hand.filter((card) => !card.joker);
  if (pips.length === 0) return hand[hand.length - 1];

  const scored = pips.map((card) => {
    const rank = card.rank as number;
    const sameRank = pips.filter((other) => other.rank === card.rank).length;
    const neighbours = pips.filter(
      (other) =>
        other.suit === card.suit &&
        other.id !== card.id &&
        Math.abs((other.rank as number) - rank) <= 2,
    ).length;
    // Plus le potentiel est faible et la carte chère, plus elle part volontiers.
    const potential = (sameRank - 1) * 3 + neighbours * 2;
    return { card, weight: potential * 10 - rank };
  });

  scored.sort((a, b) => a.weight - b.weight);
  return scored[0].card;
}

/* ------------------------------------------------------------------ */
/* Réducteur principal                                                 */
/* ------------------------------------------------------------------ */

export function reduce(
  state: RamiState,
  action: RamiAction,
  now: number = Date.now(),
): ReduceResult {
  switch (action.type) {
    case 'start_game': {
      const player = findPlayer(state, action.playerId);
      if (!player?.isHost) return { state, events: [] };
      if (!canStart(state)) return { state, events: [] };
      return startRound({ ...state, roundNumber: 0 }, now);
    }

    case 'draw_stock':
      return doDrawStock(state, action.playerId);

    case 'take_discard':
      return doTakeDiscard(state, action.playerId);

    case 'cancel_take':
      return doCancelTake(state, action.playerId);

    case 'lay_melds':
      return doLayMelds(state, action.playerId, action.melds);

    case 'extend_meld':
      return doExtend(state, action.playerId, action.meldId, action.cardIds);

    case 'reclaim_joker':
      return doReclaim(state, action.playerId, action.meldId, action.cardIds);

    case 'discard':
      return doDiscard(state, action.playerId, action.cardId, now);

    case 'next_round': {
      if (state.phase !== 'round_end') return { state, events: [] };
      const player = findPlayer(state, action.playerId);
      if (!player?.isHost) return { state, events: [] };
      return startRound(state, now);
    }

    case 'restart': {
      if (state.phase !== 'game_over') return { state, events: [] };
      const player = findPlayer(state, action.playerId);
      if (!player?.isHost) return { state, events: [] };
      return {
        state: bump(
          syncTeams({
            ...state,
            phase: 'lobby',
            roundNumber: 0,
            players: state.players.map((entry) => ({
              ...entry,
              hand: [],
              hasEntered: false,
              score: 0,
            })),
            teams: [],
            stock: [],
            discard: [],
            melds: [],
            dealerId: null,
            currentPlayerId: null,
            turn: null,
            turnDeadline: null,
            turnTotalMs: null,
            phaseEndsAt: null,
            recycles: 0,
            lastSummary: null,
            outcome: null,
          }),
        ),
        events: [],
      };
    }

    case 'tick':
      return tick(state, now);

    default:
      return { state, events: [] };
  }
}

/** Fait avancer les transitions temporisées : distribution, chrono, fin de manche. */
export function tick(state: RamiState, now: number): ReduceResult {
  if (state.phase === 'dealing' && state.phaseEndsAt !== null && now >= state.phaseEndsAt) {
    const events: RamiEvent[] = [];
    const dealerId = state.dealerId ?? bySeat(state.players)[0]?.id;
    if (!dealerId) return { state, events: [] };
    const next = beginTurn({ ...state, phase: 'playing', phaseEndsAt: null }, dealerId, now, events, {
      dealerOpening: true,
    });
    return { state: bump(next), events };
  }

  if (state.phase === 'round_end' && state.phaseEndsAt !== null && now >= state.phaseEndsAt) {
    return startRound(state, now);
  }

  if (
    state.phase === 'playing' &&
    state.currentPlayerId &&
    state.turnDeadline !== null &&
    now >= state.turnDeadline
  ) {
    const playerId = state.currentPlayerId;
    const events: RamiEvent[] = [{ type: 'timeout', playerId }];
    let current = state;

    // Un tour complet demande plusieurs actions (remise, pioche, défausse) :
    // on les applique jusqu'à ce que la main change de joueur.
    for (let guard = 0; guard < 4; guard++) {
      if (current.currentPlayerId !== playerId) break;
      const auto = autoActionFor(current, playerId);
      if (!auto) break;
      const result = reduce(current, auto, now);
      if (result.state.version === current.version) break;
      current = result.state;
      events.push(...result.events);
    }

    return { state: current, events };
  }

  return { state, events: [] };
}

/** Prochaine échéance connue de la machine d'état (pilote le planificateur serveur). */
export function nextDeadline(state: RamiState): number | null {
  if (state.phase === 'dealing' || state.phase === 'round_end') return state.phaseEndsAt;
  if (state.phase === 'playing') return state.turnDeadline;
  return null;
}

/** Nombre de jokers encore sur la table : affiché, et utile aux tests. */
export function jokersOnTable(state: RamiState): number {
  return state.melds.reduce((sum, meld) => sum + jokerCountOf(meld), 0);
}
