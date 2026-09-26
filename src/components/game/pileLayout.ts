/** Décalages déterministes des cartes posées : chaque pli semble empilé à la main. */

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unit(value: string, salt: number): number {
  return ((hash(value + ':' + salt) % 2000) / 1000 - 1);
}

export interface Offset {
  dx: number;
  dy: number;
  rotate: number;
}

/** Position d'une pose dans la pile : légère dérive et rotation propres à chaque pose. */
export function setOffset(setId: string, order: number, cardWidth: number): Offset {
  return {
    dx: unit(setId, 1) * cardWidth * 0.11,
    dy: unit(setId, 2) * cardWidth * 0.08 - order * cardWidth * 0.018,
    rotate: unit(setId, 3) * 7 + (order % 2 === 0 ? -1.5 : 1.5),
  };
}

/** Position d'une carte à l'intérieur de sa combinaison (paire, brelan, carré). */
export function cardOffset(
  setId: string,
  index: number,
  count: number,
  cardWidth: number,
): Offset {
  const spread = cardWidth * (count > 3 ? 0.3 : 0.34);
  const centered = index - (count - 1) / 2;
  return {
    dx: centered * spread,
    dy: Math.abs(centered) * cardWidth * 0.035 + unit(setId + index, 4) * cardWidth * 0.015,
    rotate: centered * (count > 3 ? 6 : 7) + unit(setId + index, 5) * 2.5,
  };
}

export function combinedOffset(
  setId: string,
  order: number,
  index: number,
  count: number,
  cardWidth: number,
): Offset {
  const base = setOffset(setId, order, cardWidth);
  const inner = cardOffset(setId, index, count, cardWidth);
  return {
    dx: base.dx + inner.dx,
    dy: base.dy + inner.dy,
    rotate: base.rotate + inner.rotate,
  };
}
