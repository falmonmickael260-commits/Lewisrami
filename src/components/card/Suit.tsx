import type { Suit as SuitType } from '@/game/types';

/**
 * Enseignes dessinées en chemins vectoriels dans une boîte 100 × 100.
 * Aucun glyphe de police, aucune image : le rendu reste net à toutes les tailles.
 */
const PATHS: Record<Exclude<SuitType, 'C'>, string> = {
  S: 'M50 6c0 0 40 27.5 40 51.5C90 71.5 80.6 81 68.4 81c-6.9 0-12.6-3.2-16.1-8.2 0.4 10.3 3.8 17.6 9.7 21.2H38c5.9-3.6 9.3-10.9 9.7-21.2-3.5 5-9.2 8.2-16.1 8.2C19.4 81 10 71.5 10 57.5 10 33.5 50 6 50 6z',
  H: 'M50 91C50 91 7 61.6 7 35.8 7 19.9 18.6 9 31.8 9c8.4 0 15 4.6 18.2 11C53.2 13.6 59.8 9 68.2 9 81.4 9 93 19.9 93 35.8 93 61.6 50 91 50 91z',
  D: 'M50 4c8.9 19.8 21.4 34.9 38 46-16.6 11.1-29.1 26.2-38 46-8.9-19.8-21.4-34.9-38-46C28.6 38.9 41.1 23.8 50 4z',
};

export function SuitShape({ suit }: { suit: SuitType }) {
  if (suit === 'C') {
    return (
      <g>
        <circle cx="50" cy="28" r="20" />
        <circle cx="26" cy="58" r="20" />
        <circle cx="74" cy="58" r="20" />
        <path d="M46 55h8c-0.4 17 2.6 29.2 9 37H37c6.4-7.8 9.4-20 9-37z" />
      </g>
    );
  }
  return <path d={PATHS[suit]} />;
}

/** Enseigne positionnée et mise à l'échelle dans le repère de la carte. */
export function SuitPip({
  suit,
  x,
  y,
  size,
  flip = false,
  opacity = 1,
}: {
  suit: SuitType;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
  opacity?: number;
}) {
  const scale = size / 100;
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${flip ? 180 : 0}) scale(${scale}) translate(-50 -50)`}
      opacity={opacity}
    >
      <SuitShape suit={suit} />
    </g>
  );
}
