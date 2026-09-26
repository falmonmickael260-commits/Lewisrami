import type { Rank } from '@/game/types';

/** Géométrie de référence d'une carte (ratio poker 2,5 × 3,5). */
export const CARD_W = 250;
export const CARD_H = 350;
export const CARD_RATIO = CARD_W / CARD_H;
export const CARD_RADIUS = 18;

/** Zone occupée par les figures centrales. */
export const PIP_FIELD = { left: 69, right: 181, top: 80, bottom: 270 };

type Point = { x: number; y: number; flip?: boolean };

const COL = {
  left: PIP_FIELD.left,
  center: (PIP_FIELD.left + PIP_FIELD.right) / 2,
  right: PIP_FIELD.right,
};

function row(t: number) {
  return PIP_FIELD.top + t * (PIP_FIELD.bottom - PIP_FIELD.top);
}

function pair(t: number): Point[] {
  return [
    { x: COL.left, y: row(t), flip: t > 0.5 },
    { x: COL.right, y: row(t), flip: t > 0.5 },
  ];
}

function center(t: number): Point {
  return { x: COL.center, y: row(t), flip: t > 0.5 };
}

/**
 * Dispositions traditionnelles des enseignes.
 * Les figures de la moitié basse sont retournées à 180°, comme sur un vrai jeu.
 */
const LAYOUTS: Partial<Record<Rank, Point[]>> = {
  3: [center(0), center(0.5), center(1)],
  4: [...pair(0), ...pair(1)],
  5: [...pair(0), center(0.5), ...pair(1)],
  6: [...pair(0), ...pair(0.5), ...pair(1)],
  7: [...pair(0), center(0.25), ...pair(0.5), ...pair(1)],
  8: [...pair(0), center(0.25), ...pair(0.5), center(0.75), ...pair(1)],
  9: [
    ...pair(0),
    ...pair(1 / 3),
    center(0.5),
    ...pair(2 / 3),
    ...pair(1),
  ],
  10: [
    ...pair(0),
    center(1 / 6),
    ...pair(1 / 3),
    ...pair(2 / 3),
    center(5 / 6),
    ...pair(1),
  ],
  15: [center(0), center(1)],
};

export function pipLayout(rank: Rank): Point[] {
  return LAYOUTS[rank] ?? [];
}

export const PIP_SIZE = 44;
export const ACE_PIP_SIZE = 108;
