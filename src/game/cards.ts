import type { Card, CardId, Rank, Suit } from './types';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'] as const;

/** Du plus faible (3) au plus fort (2, encodé 15). */
export const RANKS: readonly Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

export const QUEEN_OF_SPADES: CardId = '12S';

const RANK_LABELS: Record<Rank, string> = {
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
  14: 'A',
  15: '2',
};

const RANK_NAMES: Record<Rank, string> = {
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
  14: 'as',
  15: 'deux',
};

const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_NAMES: Record<Suit, string> = {
  S: 'pique',
  H: 'cœur',
  D: 'carreau',
  C: 'trèfle',
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

/** Nom complet de la valeur (« dame »), par opposition à l'index court (« D »). */
export function rankName(rank: Rank, plural = false): string {
  const name = RANK_NAMES[rank];
  if (!plural || name.endsWith('s')) return name;
  return `${name}s`;
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOLS[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Libellé accessible, lu par les lecteurs d'écran. */
export function cardLabel(card: Card): string {
  return `${RANK_NAMES[card.rank]} de ${SUIT_NAMES[card.suit]}`;
}

/** La dame est le seul nom de carte féminin : « une dame », mais « un roi ». */
const FEMININE_RANKS: ReadonlySet<Rank> = new Set<Rank>([12]);

export function comboLabel(rank: Rank, count: number): string {
  const base = RANK_NAMES[rank];
  if (count === 1) return `${FEMININE_RANKS.has(rank) ? 'une' : 'un'} ${base}`;
  const plural = base.endsWith('s') ? base : `${base}s`;
  if (count === 2) return `une paire de ${plural}`;
  if (count === 3) return `un brelan de ${plural}`;
  return `un carré de ${plural}`;
}

export function makeCardId(rank: Rank, suit: Suit): CardId {
  return `${rank}${suit}`;
}

export function parseCardId(id: CardId): Card | null {
  const suit = id.slice(-1) as Suit;
  if (!SUITS.includes(suit)) return null;
  const rank = Number(id.slice(0, -1)) as Rank;
  if (!RANKS.includes(rank)) return null;
  return { id, rank, suit };
}

/** Jeu classique de 52 cartes, sans joker. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: makeCardId(rank, suit), rank, suit });
    }
  }
  return deck;
}

const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

/** Tri de main : par force croissante, puis par couleur, pour une main lisible. */
export function sortHand(cards: readonly Card[]): Card[] {
  return cards
    .slice()
    .sort((a, b) => a.rank - b.rank || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]);
}

/**
 * Distribue le paquet aussi équitablement que possible.
 * Les restes sont répartis un par un, en commençant par le premier joueur.
 */
export function deal(deck: readonly Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, index) => {
    hands[index % playerCount].push(card);
  });
  return hands.map(sortHand);
}
