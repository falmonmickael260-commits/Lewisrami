/**
 * Retour haptique léger sur mobile. Silencieux là où l'API n'existe pas
 * (iOS Safari, ordinateurs de bureau) : c'est un bonus, jamais un prérequis.
 */
type Pattern = 'tap' | 'select' | 'impact' | 'success';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 12,
  impact: [0, 18, 40, 26],
  success: [0, 14, 60, 14, 60, 26],
};

export function haptic(pattern: Pattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* certains navigateurs refusent hors geste utilisateur */
  }
}
