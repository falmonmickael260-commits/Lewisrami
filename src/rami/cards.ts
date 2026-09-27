import type { CardId, RamiCard, RamiRank, RunValue, Suit } from './types';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'] as const;

/** De l'As (1) au Roi (13). */
export const RANKS: readonly RamiRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

/** Deux jeux de 52 cartes plus 4 jokers. */
export const DECK_COUNT = 2;
export const JOKER_COUNT = 4;
export const TOTAL_CARDS = DECK_COUNT * 52 + JOKER_COUNT; // 108

/** Cartes distribuées à chaque joueur, et au donneur. */
export const HAND_SIZE = 14;
export const DEALER_HAND_SIZE = 15;

/** Points d'un joker resté en main en fin de manche. */
export const JOKER_HAND_POINTS = 25;
/** Points d'un As resté en main : l'As en main vaut toujours 11. */
export const ACE_HAND_POINTS = 11;
/** Points forfaitaires d'un joueur qui n'a jamais posé. */
export const NEVER_MELDED_POINTS = 100;

const RANK_LABELS: Record<RamiRank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'V',
  12: 'D',
  13: 'R',
};

const RANK_NAMES: Record<RamiRank, string> = {
  1: 'as',
  2: 'deux',
  3: 'trois',
  4: 'quatre',
  5: 'cinq',
  6: 'six',
  7: 'sept',
  8: 'huit',
  9: 'neuf',
  10: 'dix',
  11: 'valet',
  12: 'dame',
  13: 'roi',
};

const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_NAMES: Record<Suit, string> = {
  S: 'pique',
  H: 'cœur',
  D: 'carreau',
  C: 'trèfle',
};

export function rankLabel(rank: RamiRank): string {
  return RANK_LABELS[rank];
}

export function rankName(rank: RamiRank): string {
  return RANK_NAMES[rank];
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

export function suitName(suit: Suit): string {
  return SUIT_NAMES[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Libellé court affichable : `♥7`, `JOKER`. */
export function shortLabel(card: RamiCard): string {
  if (card.joker) return 'JOKER';
  return `${SUIT_SYMBOLS[card.suit as Suit]}${RANK_LABELS[card.rank as RamiRank]}`;
}

/** Libellé accessible, lu par les lecteurs d'écran. */
export function cardLabel(card: RamiCard): string {
  if (card.joker) return 'joker';
  return `${RANK_NAMES[card.rank as RamiRank]} de ${SUIT_NAMES[card.suit as Suit]}`;
}

/** Libellé d'une valeur + enseigne, pour les messages (« le ♥7 »). */
export function describeTarget(rank: RamiRank, suit: Suit | null): string {
  const base = `${RANK_NAMES[rank]}`;
  return suit ? `${base} de ${SUIT_NAMES[suit]}` : base;
}

/* ------------------------------------------------------------------ */
/* Identifiants                                                        */
/* ------------------------------------------------------------------ */

export function makeCardId(rank: RamiRank, suit: Suit, deck: number): CardId {
  return `${rank}${suit}_${deck}`;
}

export function makeJokerId(index: number): CardId {
  return `X_${index}`;
}

/** Forme attendue d'un identifiant de carte. Utilisée aussi par la validation serveur. */
export const CARD_ID_PATTERN = /^(?:(?:[1-9]|1[0-3])[SHDC]_[01]|X_[0-3])$/;

export function parseCardId(id: CardId): RamiCard | null {
  if (!CARD_ID_PATTERN.test(id)) return null;
  if (id.startsWith('X_')) {
    const index = Number(id.slice(2));
    return { id, rank: null, suit: null, joker: true, deck: index };
  }
  const [head, deckPart] = id.split('_');
  const suit = head.slice(-1) as Suit;
  const rank = Number(head.slice(0, -1)) as RamiRank;
  return { id, rank, suit, joker: false, deck: Number(deckPart) };
}

export function makeCard(rank: RamiRank, suit: Suit, deck = 0): RamiCard {
  return { id: makeCardId(rank, suit, deck), rank, suit, joker: false, deck };
}

export function makeJoker(index = 0): RamiCard {
  return { id: makeJokerId(index), rank: null, suit: null, joker: true, deck: index };
}

/**
 * Paquet complet du Rami : deux jeux de 52 cartes plus 4 jokers, soit 108.
 * Chaque carte porte un identifiant unique, paquet d'origine compris.
 */
export function createDeck(): RamiCard[] {
  const deck: RamiCard[] = [];
  for (let d = 0; d < DECK_COUNT; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) deck.push(makeCard(rank, suit, d));
    }
  }
  for (let j = 0; j < JOKER_COUNT; j++) deck.push(makeJoker(j));
  return deck;
}

/* ------------------------------------------------------------------ */
/* Valeurs et positions                                                */
/* ------------------------------------------------------------------ */

/**
 * Positions possibles d'une carte dans une suite.
 *
 * L'As est la seule carte à en avoir deux : 1 (A-2-3) et 14 (Q-K-A).
 * Une suite ne « fait jamais le tour » : R-A-2 n'existe pas, ce qui tombe
 * naturellement puisque 13-14 et 1-2 sont deux intervalles disjoints.
 */
export function runValuesOf(rank: RamiRank): RunValue[] {
  return rank === 1 ? [1, 14] : [rank];
}

/** Valeur en points d'une carte à une position donnée dans une suite. */
export function pointsAtRunValue(runValue: RunValue): number {
  if (runValue === 1) return 1; // As bas (A-2-3)
  if (runValue === 14) return ACE_HAND_POINTS; // As haut (Q-K-A)
  if (runValue >= 11) return 10; // Valet, Dame, Roi
  return runValue; // 2 à 10
}

/**
 * Valeur en points d'une carte dans un brelan ou un carré.
 * L'As y vaut toujours 11 ; les figures 10 ; le reste sa valeur faciale.
 */
export function pointsInSet(rank: RamiRank): number {
  if (rank === 1) return ACE_HAND_POINTS;
  if (rank >= 11) return 10;
  return rank;
}

/**
 * Valeur en points d'une carte restée en main.
 * Joker 25, As 11, figures 10, le reste sa valeur faciale.
 */
export function handPoints(card: RamiCard): number {
  if (card.joker) return JOKER_HAND_POINTS;
  return pointsInSet(card.rank as RamiRank);
}

/** Somme des points d'une main. */
export function handTotal(cards: readonly RamiCard[]): number {
  return cards.reduce((sum, card) => sum + handPoints(card), 0);
}

/** Valeur faciale correspondant à une position de suite. */
export function rankAtRunValue(runValue: RunValue): RamiRank | null {
  if (runValue === 14) return 1;
  if (runValue >= 1 && runValue <= 13) return runValue as RamiRank;
  return null;
}

/* ------------------------------------------------------------------ */
/* Tri                                                                 */
/* ------------------------------------------------------------------ */

const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

/**
 * Tri de main lisible : les jokers en tête, puis par enseigne et par valeur.
 * Regrouper par enseigne fait apparaître les tierces à l'œil nu.
 */
export function sortHand(cards: readonly RamiCard[]): RamiCard[] {
  return cards.slice().sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? -1 : 1;
    if (a.joker && b.joker) return a.deck - b.deck;
    const suitDelta = SUIT_ORDER[a.suit as Suit] - SUIT_ORDER[b.suit as Suit];
    if (suitDelta !== 0) return suitDelta;
    const rankDelta = (a.rank as number) - (b.rank as number);
    if (rankDelta !== 0) return rankDelta;
    return a.deck - b.deck;
  });
}

/** Tri par valeur d'abord : fait apparaître les brelans à l'œil nu. */
export function sortHandByRank(cards: readonly RamiCard[]): RamiCard[] {
  return cards.slice().sort((a, b) => {
    if (a.joker !== b.joker) return a.joker ? -1 : 1;
    if (a.joker && b.joker) return a.deck - b.deck;
    const rankDelta = (a.rank as number) - (b.rank as number);
    if (rankDelta !== 0) return rankDelta;
    const suitDelta = SUIT_ORDER[a.suit as Suit] - SUIT_ORDER[b.suit as Suit];
    if (suitDelta !== 0) return suitDelta;
    return a.deck - b.deck;
  });
}
