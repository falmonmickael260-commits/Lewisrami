import type { Phase } from '@/game/types';

export const PHASE_LABELS: Record<Phase, string> = {
  lobby: 'Salon',
  dealing: 'Distribution',
  exchange: 'Échange des cartes',
  playing: 'En jeu',
  round_end: 'Fin de manche',
  game_over: 'Partie terminée',
};

/** Centre de l'aire de jeu, en fraction de la hauteur de la table. */
export const ARENA_CENTER_Y = 0.45;
/** Au-delà, les sièges s'éloigneraient trop du pli sur très grand écran. */
const MAX_SEAT_RX = 520;
const MAX_SEAT_RY = 250;

export interface Size {
  width: number;
  height: number;
}

/**
 * Répartit les adversaires sur une ellipse, le joueur local occupant le bas.
 * Les positions sont calculées en pixels à partir de la taille mesurée, ce qui
 * garantit qu'aucun siège ne déborde de la table.
 */
export function seatPosition(
  index: number,
  total: number,
  size: Size,
  seatHalfWidth: number,
  seatHalfHeight: number,
) {
  const angle = (90 + ((index + 1) * 360) / total) * (Math.PI / 180);
  const centerY = size.height * ARENA_CENTER_Y;
  const rx = Math.max(40, Math.min(size.width / 2 - seatHalfWidth - 4, MAX_SEAT_RX));
  const ry = Math.max(
    30,
    Math.min(
      // Marge haute plus généreuse : le siège du haut ne passe jamais sous
      // le bandeau de notifications.
      centerY - seatHalfHeight - 30,
      size.height - centerY - seatHalfHeight - 6,
      size.width * 0.44,
      MAX_SEAT_RY,
    ),
  );
  return {
    left: size.width / 2 + Math.cos(angle) * rx,
    top: centerY + Math.sin(angle) * ry,
  };
}

/** Largeur d'une carte du pli, adaptée à la place réellement disponible. */
export function pileCardWidth(size: Size, compact: boolean): number {
  if (size.width === 0) return 76;
  const byWidth = compact ? size.width * 0.175 : size.width * 0.082;
  const byHeight = size.height * 0.2;
  return Math.round(
    Math.max(48, Math.min(compact ? 78 : 112, Math.min(byWidth, byHeight))),
  );
}

/**
 * Sur écran étroit et table nombreuse, l'ellipse ne tient plus : les
 * adversaires passent dans un bandeau supérieur et le pli descend.
 */
export function stripPileTopPercent(size: Size, opponentCount: number): number {
  const rows = Math.ceil(opponentCount / 4);
  const stripHeight = rows * 92;
  if (size.height === 0) return 60;
  return Math.min(76, ((stripHeight + (size.height - stripHeight) * 0.44) / size.height) * 100);
}
