/**
 * Garde-fou de performance du solveur.
 *
 * Il tourne à chaque synchronisation pendant le tour d'un joueur, pour proposer
 * une ouverture : une main tordue ne doit jamais faire ramer la table.
 */

import { describe, expect, it } from 'vitest';
import { findLayDown, enumerateCandidates } from './solver';
import { createDeck, sortHand } from './cards';
import { createRng, shuffle } from '@/game/rng';
import { cards } from './testUtils';

describe('performance du solveur', () => {
  it('reste rapide sur des mains tirées au hasard', () => {
    const rng = createRng(4242);
    let worst = 0;
    let worstSize = 0;
    for (let i = 0; i < 300; i++) {
      const hand = sortHand(shuffle(createDeck(), rng).slice(0, 15));
      const t = performance.now();
      findLayDown(hand, { minPoints: 71, requireRun: true, keepAtLeast: 1 });
      const ms = performance.now() - t;
      if (ms > worst) { worst = ms; worstSize = enumerateCandidates(hand).length; }
    }
    console.log(`main aléatoire — pire cas ${worst.toFixed(1)} ms (${worstSize} candidats)`);
    expect(worst).toBeLessThan(120);
  });

  it('reste rapide sur une main pathologique', () => {
    // Beaucoup de doublons et de suites qui se recouvrent : le pire cas réel.
    const hand = sortHand(cards("H2 H3 H4 H5 H6 H7 H8 H2' H3' H4' X X1 S2 S3 S4"));
    const t = performance.now();
    const lay = findLayDown(hand, { minPoints: 71, requireRun: true, keepAtLeast: 1 });
    const ms = performance.now() - t;
    console.log(
      `main pathologique — ${ms.toFixed(1)} ms (${enumerateCandidates(hand).length} candidats, ${lay ? lay.points : 0} pts)`,
    );
    expect(ms).toBeLessThan(400);
  });
});
