/**
 * Outils de test du moteur Rami.
 *
 * Ils servent à **fabriquer une situation précise** — telle main, telle défausse,
 * telle combinaison sur la table — pour vérifier une règle isolément, sans
 * dépendre du hasard de la distribution.
 */

import { makeCard, makeJoker, sortHand } from './cards';
import { buildMeld } from './melds';
import { settingsFor, syncTeams } from './engine';
import { teamOfSeat } from './scoring';
import type {
  GameMode,
  Meld,
  MeldKind,
  RamiCard,
  RamiPlayer,
  RamiState,
  Suit,
  TurnStage,
  TurnState,
} from './types';
import type { RamiRank } from './types';

const SUIT_BY_LETTER: Record<string, Suit> = {
  S: 'S',
  P: 'S', // pique
  H: 'H',
  C: 'C',
  T: 'C', // trèfle
  D: 'D',
  K: 'D', // karreau — évite la collision avec le Roi
};

const RANK_BY_LABEL: Record<string, RamiRank> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  V: 11,
  Q: 12,
  D: 12,
  K: 13,
  R: 13,
};

/**
 * Carte depuis une notation courte : `H7` (7 de cœur), `SA` (as de pique),
 * `HR` ou `HK` (roi de cœur), `H7'` (second exemplaire), `X` / `X2` (joker).
 */
export function c(spec: string): RamiCard {
  const doubled = spec.endsWith("'");
  const body = doubled ? spec.slice(0, -1) : spec;

  if (body[0] === 'X') {
    const index = body.length > 1 ? Number(body.slice(1)) : 0;
    return makeJoker(index);
  }

  const suit = SUIT_BY_LETTER[body[0]];
  const rankLabel = body.slice(1).toUpperCase();
  const rank = RANK_BY_LABEL[rankLabel];
  if (!suit || rank === undefined) throw new Error(`Carte illisible : ${spec}`);
  return makeCard(rank, suit, doubled ? 1 : 0);
}

/** Plusieurs cartes d'un coup : `cards('H5 H6 H7')`. */
export function cards(spec: string): RamiCard[] {
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => c(entry));
}

export interface TableOptions {
  mode?: GameMode;
  /** Mains, dans l'ordre des sièges. */
  hands: string[];
  stock?: string;
  discard?: string;
  /** Combinaisons déjà posées, avec leur propriétaire. */
  melds?: { by: number; kind?: MeldKind; cards: string; jokerRank?: RamiRank; jokerSuit?: Suit }[];
  /** Équipes déjà ouvertes : `{ [teamId]: score }`. */
  openings?: Record<number, number>;
  /** Joueurs ayant déjà posé, par siège. */
  entered?: number[];
  /** Siège dont c'est le tour. */
  current?: number;
  stage?: TurnStage;
  takenCardId?: string;
  dealer?: number;
  teamScores?: Record<number, number>;
  roundNumber?: number;
}

const NAMES = ['Alice', 'Bruno', 'Chloé', 'David'];
const AVATARS = ['🦊', '🐻', '🦉', '🐸'];

/**
 * Fabrique un état « en cours de partie » entièrement déterminé.
 * Les mains ne sont jamais tirées au hasard : chaque test décrit la sienne.
 */
export function makeTable(options: TableOptions): RamiState {
  const mode = options.mode ?? (options.hands.length === 4 ? '2v2' : options.hands.length === 3 ? '1v1v1' : '1v1');
  const settings = settingsFor(mode, 45);

  const players: RamiPlayer[] = options.hands.map((spec, seat) => ({
    id: `p${seat}`,
    name: NAMES[seat % NAMES.length],
    avatar: AVATARS[seat % AVATARS.length],
    seat,
    teamId: teamOfSeat(seat, mode),
    isHost: seat === 0,
    isBot: false,
    connected: true,
    hand: sortHand(cards(spec)),
    hasEntered: (options.entered ?? []).includes(seat),
    score: 0,
  }));

  const currentSeat = options.current ?? 0;
  const dealerSeat = options.dealer ?? 0;

  const turn: TurnState = {
    stage: options.stage ?? 'meld',
    drawnFrom: options.takenCardId ? 'discard' : options.stage === 'draw' ? null : 'stock',
    takenCardId: options.takenCardId ?? null,
    takenCardUsed: false,
    meldedThisTurn: false,
    isDealerOpening: false,
  };

  let state: RamiState = syncTeams({
    phase: 'playing',
    settings,
    roundNumber: options.roundNumber ?? 1,
    players,
    teams: [],
    stock: cards(options.stock ?? ''),
    discard: cards(options.discard ?? ''),
    melds: [],
    dealerId: players[dealerSeat].id,
    currentPlayerId: players[currentSeat].id,
    turn,
    turnDeadline: null,
    turnTotalMs: null,
    phaseEndsAt: null,
    version: 1,
    seed: 12345,
    recycles: 0,
    lastSummary: null,
    outcome: null,
    createdAt: 0,
  });

  // Combinaisons déjà sur la table.
  const melds: Meld[] = (options.melds ?? []).map((entry, index) => {
    const owner = players[entry.by];
    const built = buildMeld(
      { kind: entry.kind ?? 'run', jokerRank: entry.jokerRank, jokerSuit: entry.jokerSuit },
      cards(entry.cards),
      owner.id,
    );
    if (!built.ok) throw new Error(`Combinaison de test invalide : ${entry.cards} — ${built.message}`);
    return {
      id: `t${index}`,
      kind: built.kind,
      teamId: owner.teamId,
      ownerId: owner.id,
      suit: built.suit,
      rank: built.rank,
      slots: built.slots,
      roundNumber: state.roundNumber,
    };
  });

  state = {
    ...state,
    melds,
    teams: state.teams.map((team) => {
      const opening = options.openings?.[team.id];
      return {
        ...team,
        score: options.teamScores?.[team.id] ?? 0,
        opening:
          opening === undefined
            ? team.opening
            : {
                opened: true,
                score: opening,
                byId: players.find((player) => player.teamId === team.id)?.id ?? null,
              },
      };
    }),
  };

  return state;
}

/** Main d'un joueur, en notation courte, pour des assertions lisibles. */
export function handOf(state: RamiState, seat: number): string[] {
  const player = state.players.find((entry) => entry.seat === seat);
  return (player?.hand ?? []).map((card) => card.id);
}

export function playerId(state: RamiState, seat: number): string {
  const player = state.players.find((entry) => entry.seat === seat);
  if (!player) throw new Error(`Siège ${seat} inexistant`);
  return player.id;
}
