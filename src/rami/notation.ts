/**
 * Notation courte d'une carte : `H7`, `SA`, `HR`, `H7'`, `X`.
 *
 * Elle sert à écrire des exemples lisibles — dans les tests comme dans le
 * règlement illustré, où chaque exemple est rendu avec les vraies cartes
 * vectorielles du jeu.
 */

import { makeCard, makeJoker } from './cards';
import type { RamiCard, RamiRank, Suit } from './types';

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
 * Carte depuis une notation courte.
 * L'apostrophe finale désigne le second exemplaire (`H7'`), `X2` le joker n° 2.
 */
export function cardFromSpec(spec: string): RamiCard {
  const doubled = spec.endsWith("'");
  const body = doubled ? spec.slice(0, -1) : spec;

  if (body[0] === 'X') {
    const index = body.length > 1 ? Number(body.slice(1)) : 0;
    return makeJoker(Number.isFinite(index) ? index : 0);
  }

  const suit = SUIT_BY_LETTER[body[0]];
  const rank = RANK_BY_LABEL[body.slice(1).toUpperCase()];
  if (!suit || rank === undefined) throw new Error(`Carte illisible : ${spec}`);
  return makeCard(rank, suit, doubled ? 1 : 0);
}

/** Plusieurs cartes d'un coup : `cardsFromSpec('H5 H6 H7')`. */
export function cardsFromSpec(spec: string): RamiCard[] {
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => cardFromSpec(entry));
}
