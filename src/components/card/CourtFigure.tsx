import type { Suit } from '@/game/types';
import { SuitPip } from './Suit';

/**
 * Moitié d'une figure de cour.
 *
 * Composition héraldique — monogramme, couronne et enseigne — plutôt qu'un
 * personnage détaillé : à 50 px de large dans une main éventaillée, un visage
 * dessiné devient illisible alors qu'une lettre reste parfaitement nette.
 * La moitié basse est cette même composition pivotée à 180°, comme sur un
 * jeu traditionnel.
 */

const ORNAMENTS: Record<string, string> = {
  // Roi : couronne à cinq pointes.
  R: 'M-26 10 L-26 -8 L-15 2 L-8 -14 L0 -1 L8 -14 L15 2 L26 -8 L26 10 Z',
  // Dame : diadème.
  D: 'M-21 9 L-18 -5 L-10 2 L0 -9 L10 2 L18 -5 L21 9 Z',
  // Valet : bandeau à plume.
  V: 'M-19 9 L-19 2 C-19 -8 19 -8 19 2 L19 9 Z',
};

export function CourtFigure({
  letter,
  suit,
  color,
  gold,
}: {
  letter: 'V' | 'D' | 'R';
  suit: Suit;
  color: string;
  gold: string;
}) {
  return (
    <g>
      <g transform="translate(96 94)">
        <path d={ORNAMENTS[letter]} fill={gold} stroke={color} strokeWidth={1.1} />
        {letter === 'R' && (
          <g fill={color}>
            <circle cx={-8} cy={-14} r={2.2} />
            <circle cx={0} cy={-1} r={2} />
            <circle cx={8} cy={-14} r={2.2} />
          </g>
        )}
        {letter === 'D' && <circle cy={-9} r={2.4} fill={color} />}
        {letter === 'V' && (
          <path
            d="M6 -6 C14 -20 24 -24 30 -23 C29 -14 22 -6 12 -2 Z"
            fill={color}
            opacity={0.85}
          />
        )}
      </g>

      <text
        x={96}
        y={160}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize={76}
        fill={color}
        style={{ fontVariantLigatures: 'none' }}
      >
        {letter}
      </text>

      <g fill={color}>
        <SuitPip suit={suit} x={160} y={128} size={34} />
      </g>

    </g>
  );
}
