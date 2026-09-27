/**
 * Identité visuelle des équipes et libellés du Rami.
 *
 * Une équipe n'est jamais identifiée par la seule couleur : elle porte toujours
 * un nom et une pastille, pour rester lisible en cas de daltonisme.
 */

import type { GameMode } from '@/rami/types';

export interface TeamStyle {
  /** Teinte principale, en notation CSS. */
  accent: string;
  /** Fond de carte de combinaison. */
  surface: string;
  border: string;
  glow: string;
  chip: string;
  label: string;
  short: string;
}

const PALETTE: TeamStyle[] = [
  {
    accent: '#ecd08a',
    surface: 'linear-gradient(160deg, rgba(236,208,138,0.13), rgba(236,208,138,0.03))',
    border: 'rgba(236,208,138,0.34)',
    glow: 'rgba(236,208,138,0.35)',
    chip: 'bg-gold-500/18 text-gold-300 border-gold-500/40',
    label: 'Équipe Or',
    short: 'Or',
  },
  {
    accent: '#67d9d0',
    surface: 'linear-gradient(160deg, rgba(103,217,208,0.13), rgba(103,217,208,0.03))',
    border: 'rgba(103,217,208,0.34)',
    glow: 'rgba(103,217,208,0.35)',
    chip: 'bg-teal-300/15 text-teal-200 border-teal-300/40',
    label: 'Équipe Jade',
    short: 'Jade',
  },
  {
    accent: '#c79cf5',
    surface: 'linear-gradient(160deg, rgba(199,156,245,0.13), rgba(199,156,245,0.03))',
    border: 'rgba(199,156,245,0.34)',
    glow: 'rgba(199,156,245,0.35)',
    chip: 'bg-violet-300/15 text-violet-200 border-violet-300/40',
    label: 'Équipe Améthyste',
    short: 'Améthyste',
  },
  {
    accent: '#f2a06a',
    surface: 'linear-gradient(160deg, rgba(242,160,106,0.13), rgba(242,160,106,0.03))',
    border: 'rgba(242,160,106,0.34)',
    glow: 'rgba(242,160,106,0.35)',
    chip: 'bg-orange-300/15 text-orange-200 border-orange-300/40',
    label: 'Équipe Ambre',
    short: 'Ambre',
  },
];

export function teamStyle(teamId: number): TeamStyle {
  return PALETTE[teamId % PALETTE.length];
}

/**
 * Nom affiché d'une équipe. En 1 vs 1 et 1 vs 1 vs 1 chaque joueur est sa
 * propre équipe : on affiche alors son pseudo, pas une couleur abstraite.
 */
export function teamName(
  teamId: number,
  mode: GameMode,
  players: readonly { teamId: number; name: string }[],
): string {
  if (mode === '2v2') return teamStyle(teamId).label;
  const owner = players.find((player) => player.teamId === teamId);
  return owner?.name ?? teamStyle(teamId).short;
}

export const PHASE_LABELS: Record<string, string> = {
  lobby: 'Salon',
  dealing: 'Distribution',
  playing: 'En jeu',
  round_end: 'Fin de manche',
  game_over: 'Partie terminée',
};
