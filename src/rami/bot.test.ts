import { describe, expect, it } from 'vitest';
import { canUseImmediately, decideBotAction } from './bot';
import {
  DEAL_MS,
  addPlayer,
  createGame,
  nextDeadline,
  reduce,
  requiredPlayers,
  tick,
} from './engine';
import { TOTAL_CARDS } from './cards';
import { findExtensions, findLayDown, enumerateCandidates, orphanCards } from './solver';
import { c, cards, makeTable } from './testUtils';
import type { GameMode, RamiState } from './types';

/* ------------------------------------------------------------------ */
/* Solveur                                                             */
/* ------------------------------------------------------------------ */

describe('solveur', () => {
  it('trouve une ouverture à 71 points exactement quand elle existe', () => {
    const hand = cards('H10 HV HD HR HA S5 H5 D5 C5 S2 S3 D8 C9 H2');
    const lay = findLayDown(hand, { minPoints: 71, requireRun: true });
    expect(lay).not.toBeNull();
    expect(lay!.points).toBeGreaterThanOrEqual(71);
    expect(lay!.hasQualifyingRun).toBe(true);
  });

  it('renonce quand le seuil est hors de portée', () => {
    const hand = cards('S2 S3 S4 H7 H8 D10 DV C5 C6 H2 H3 D2 D3 C9');
    const lay = findLayDown(hand, { minPoints: 71, requireRun: true });
    expect(lay).toBeNull();
  });

  it('exige une vraie tierce même si les points suffisent', () => {
    // 71 points sont atteignables, mais aucune tierce de trois vraies cartes.
    const hand = cards('SA HA DA CA SR HR DR CR S2 H2 D3 C4 H5 D6');
    const withRun = findLayDown(hand, { minPoints: 71, requireRun: true });
    expect(withRun).toBeNull();
    const withoutRun = findLayDown(hand, { minPoints: 71, requireRun: false });
    expect(withoutRun).not.toBeNull();
  });

  it('utilise le joker pour franchir le seuil', () => {
    const hand = cards('HV HD HR HA S10 H10 X S2 S3 D4 C5 H6 D7 C8');
    const lay = findLayDown(hand, { minPoints: 71, requireRun: true });
    expect(lay).not.toBeNull();
    expect(lay!.points).toBeGreaterThanOrEqual(71);
  });

  it('garde toujours une carte à jeter', () => {
    // Douze cartes toutes combinables : la pose ne peut pas tout engager.
    const hand = cards('H5 H6 H7 H8 H9 H10 S5 D5 C5 S9 D9 C9');
    const lay = findLayDown(hand, { keepAtLeast: 1 });
    expect(lay).not.toBeNull();
    expect(lay!.cardIds.length).toBeLessThanOrEqual(hand.length - 1);
  });

  it('impose la présence d’une carte donnée', () => {
    const hand = cards('H8 H9 H10 S2 S3 D4');
    const lay = findLayDown(hand, { mustInclude: c('H8').id });
    expect(lay).not.toBeNull();
    expect(lay!.cardIds).toContain(c('H8').id);

    const impossible = findLayDown(hand, { mustInclude: c('D4').id });
    expect(impossible).toBeNull();
  });

  it('repère les cartes orphelines', () => {
    const orphans = orphanCards(cards('H5 H6 H7 SR D2'));
    expect(orphans.map((card) => card.id).sort()).toEqual(
      cards('SR D2').map((card) => card.id).sort(),
    );
  });

  it('reste rapide sur une main pleine et très combinable', () => {
    const hand = cards('H2 H3 H4 H5 H6 H7 S2 S3 S4 D2 D3 D4 C2 X');
    const started = Date.now();
    const candidates = enumerateCandidates(hand);
    const lay = findLayDown(hand, { minPoints: 30, requireRun: true });
    expect(candidates.length).toBeGreaterThan(10);
    expect(lay).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('trouve les compléments d’une tierce posée', () => {
    const state = makeTable({
      hands: ['H4 H9 H10 S2', 'S3 S4 S5'],
      melds: [{ by: 0, cards: 'H5 H6 H7 H8' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    const options = findExtensions(state.players[0].hand, state.melds, {
      teamId: 0,
      allowOpponents: false,
    });
    expect(options).toHaveLength(1);
    expect(options[0].cardIds.sort()).toEqual(
      cards('H4 H9 H10').map((card) => card.id).sort(),
    );
  });
});

/* ------------------------------------------------------------------ */
/* Décision du bot                                                     */
/* ------------------------------------------------------------------ */

describe('bot', () => {
  it('reprend la défausse seulement si la carte est utilisable tout de suite', () => {
    const useful = makeTable({
      hands: ['H8 H9 H10 S2 S3 D4 C5 H2 D6 C7 S8 D9 C10 HR', 'S4 S5 S6'],
      discard: 'H7',
      stock: 'D2 D3',
      current: 0,
      stage: 'draw',
      openings: { 0: 71 },
      entered: [0],
      melds: [{ by: 0, cards: 'C2 C3 C4' }],
    });
    // ♥7 complète ♥8-♥9-♥10 : la reprise a du sens.
    expect(canUseImmediately(useful, useful.players[0], c('H7'))).toBe(true);
    expect(decideBotAction(useful, 'p0')).toMatchObject({ type: 'take_discard' });

    const useless = makeTable({
      hands: ['S2 H4 D6 C8 H10 SR DA C3 H5 D7 C9 SV D2 H3', 'S4 S5 S6'],
      discard: 'HD',
      stock: 'D3 D4',
      current: 0,
      stage: 'draw',
    });
    expect(decideBotAction(useless, 'p0')).toMatchObject({ type: 'draw_stock' });
  });

  it('ouvre dès que le seuil est atteignable', () => {
    const state = makeTable({
      hands: ['H10 HV HD HR HA S5 H5 D5 C5 S2 S3 D8 C9 H2', 'S4 S6 S7'],
      stock: 'D2 D3',
      current: 0,
    });
    const action = decideBotAction(state, 'p0');
    expect(action).toMatchObject({ type: 'lay_melds' });
  });

  it('jette plutôt que d’ouvrir en dessous du seuil', () => {
    const state = makeTable({
      hands: ['H5 H6 H7 S2 H4 D6 C8 H10 SR DA C3 D7 C9 SV', 'S4 S6 S8'],
      stock: 'D2 D3',
      current: 0,
    });
    const action = decideBotAction(state, 'p0');
    expect(action).toMatchObject({ type: 'discard' });
  });

  it('remet la carte reprise quand elle s’avère inutilisable', () => {
    const state = makeTable({
      hands: ['S2 H4 D6 C8 HD', 'S4 S5 S6'],
      stock: 'D2 D3',
      current: 0,
      takenCardId: c('HD').id,
    });
    expect(decideBotAction(state, 'p0')).toMatchObject({ type: 'cancel_take' });
  });

  it('complète la table quand il est déjà entré', () => {
    const state = makeTable({
      hands: ['H4 H9 S2 H3 D5 C6', 'S4 S5 S6'],
      melds: [{ by: 0, cards: 'H5 H6 H7 H8' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    expect(decideBotAction(state, 'p0')).toMatchObject({ type: 'extend_meld' });
  });

  it('ne jette jamais un joker tant qu’il reste autre chose', () => {
    const state = makeTable({
      hands: ['X SR DA H2 D3 C4 S5 H6 D7 C8 S9 H10 DV CD', 'S4 S5 S6'],
      stock: 'D2 D3',
      current: 0,
    });
    const action = decideBotAction(state, 'p0');
    expect(action?.type).toBe('discard');
    if (action?.type === 'discard') {
      expect(action.cardId).not.toBe(c('X').id);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Parties complètes                                                   */
/* ------------------------------------------------------------------ */

/** Joue une partie entière avec des bots et surveille les invariants. */
function playFullGame(mode: GameMode, seed: number) {
  let state = createGame({ settings: { mode }, seed });
  for (let i = 0; i < requiredPlayers(mode); i++) {
    state = addPlayer(state, { id: `p${i}`, name: `Bot${i}`, avatar: '🤖', isBot: true });
  }
  state = reduce(state, { type: 'start_game', playerId: 'p0' }, 0).state;

  let now = 0;
  let steps = 0;
  const maxSteps = 40_000;

  const invariant = (label: string) => {
    if (state.phase === 'dealing' || state.phase === 'playing') {
      const inHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
      const onTable = state.melds.reduce((sum, meld) => sum + meld.slots.length, 0);
      const total = inHands + onTable + state.stock.length + state.discard.length;
      expect(total, `${label} — cartes perdues`).toBe(TOTAL_CARDS);
      for (const meld of state.melds) {
        expect(
          meld.slots.filter((slot) => slot.card.joker).length,
          `${label} — deux jokers dans une combinaison`,
        ).toBeLessThanOrEqual(1);
        expect(meld.slots.length, `${label} — combinaison trop courte`).toBeGreaterThanOrEqual(3);
        if (meld.kind === 'set') {
          expect(meld.slots.length, `${label} — brelan trop large`).toBeLessThanOrEqual(4);
        }
      }
    }
  };

  while (state.phase !== 'game_over' && steps++ < maxSteps) {
    invariant(`étape ${steps}`);

    const botId = state.phase === 'playing' ? state.currentPlayerId : null;
    if (botId) {
      const action = decideBotAction(state, botId);
      if (action) {
        const before = state.version;
        const result = reduce(state, action, now);
        if (result.state.version !== before) {
          state = result.state;
          continue;
        }
      }
    }

    // Aucune action de bot : on avance l'horloge jusqu'à la prochaine échéance.
    const deadline = nextDeadline(state);
    now = deadline === null ? now + 1000 : Math.max(now, deadline) + 1;
    const ticked = tick(state, now);
    if (ticked.state.version === state.version && !botId) {
      now += DEAL_MS;
      const retry = tick(state, now);
      if (retry.state.version === state.version) break;
      state = retry.state;
      continue;
    }
    state = ticked.state;
  }

  return { state, steps };
}

describe('partie complète pilotée par des bots', () => {
  for (const mode of ['1v1', '1v1v1', '2v2'] as GameMode[]) {
    it(`va jusqu'à son terme en ${mode} sans blocage ni carte perdue`, () => {
      const { state, steps } = playFullGame(mode, 20240927);
      expect(state.phase).toBe('game_over');
      expect(steps).toBeLessThan(40_000);
      expect(state.outcome).not.toBeNull();
      expect(state.roundNumber).toBeGreaterThan(0);

      const loser = state.outcome!.loserTeamIds[0];
      expect(state.teams.find((team) => team.id === loser)!.score).toBeGreaterThanOrEqual(
        state.settings.targetScore,
      );
      // Le vainqueur est bien l'équipe la moins chargée.
      const lowest = Math.min(...state.teams.map((team) => team.score));
      expect(state.teams.find((team) => team.id === state.outcome!.winnerTeamId)!.score).toBe(
        lowest,
      );
    });
  }

  it('produit des manches qui se terminent par un gagnant', () => {
    const { state } = playFullGame('1v1', 424242);
    const summary = state.lastSummary!;
    expect(summary.teams.some((team) => team.points === 0)).toBe(true);
  });

  it('reste déterministe à graine égale', () => {
    const a = playFullGame('1v1', 777);
    const b = playFullGame('1v1', 777);
    expect(a.state.roundNumber).toBe(b.state.roundNumber);
    expect(a.state.teams.map((team) => team.score)).toEqual(
      b.state.teams.map((team) => team.score),
    );
  });
});

/** Le chrono doit toujours pouvoir débloquer une table, même sans bot. */
describe('robustesse', () => {
  it('ne laisse jamais un tour humain bloqué indéfiniment', () => {
    let state: RamiState = makeTable({
      hands: ['H5 H6 HR S2', 'S3 S4 S5 S6'],
      stock: 'D9 D10 D2 D3 D4 D5',
      discard: 'C2',
      current: 0,
      stage: 'draw',
    });
    state = { ...state, turnDeadline: 100, turnTotalMs: 1000 };

    let now = 200;
    let turnsPlayed = 0;
    const seenCurrent: string[] = [];

    for (let i = 0; i < 12; i++) {
      const before = state.currentPlayerId;
      const result = tick(state, now);
      if (result.state.version === state.version) break;
      state = result.state;
      if (before !== state.currentPlayerId) turnsPlayed++;
      seenCurrent.push(state.currentPlayerId ?? 'aucun');
      if (state.phase !== 'playing') break;
      now = (state.turnDeadline ?? now) + 1;
    }

    // Chaque expiration a joué un tour complet : la main a bien changé de joueur,
    // en alternance, sans qu'aucun joueur ne reste bloqué.
    expect(turnsPlayed).toBeGreaterThanOrEqual(6);
    expect(new Set(seenCurrent).size).toBeGreaterThan(1);
  });

  it('recycle la défausse plutôt que de bloquer une pioche vide', () => {
    let state: RamiState = makeTable({
      hands: ['H5 H6 HR S2', 'S3 S4 S5 S6'],
      stock: 'D9',
      discard: 'C2 C3 C4 C5',
      current: 0,
      stage: 'draw',
    });
    state = { ...state, turnDeadline: 100, turnTotalMs: 1000 };

    let now = 200;
    for (let i = 0; i < 8; i++) {
      const result = tick(state, now);
      if (result.state.version === state.version) break;
      state = result.state;
      if (state.phase !== 'playing') break;
      now = (state.turnDeadline ?? now) + 1;
    }

    expect(state.recycles).toBeGreaterThanOrEqual(1);
    // Après recyclage, la dernière carte jetée reste seule visible.
    expect(state.discard.length).toBeGreaterThanOrEqual(1);
  });
});
