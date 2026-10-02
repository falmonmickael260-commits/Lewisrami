import { describe, expect, it } from 'vitest';
import {
  DEAL_MS,
  addPlayer,
  canStart,
  createGame,
  leastUsefulCard,
  reduce,
  requiredPlayers,
  setMode,
  startRound,
  tick,
} from './engine';
import {
  validateDiscard,
  validateExtend,
  validateLayMelds,
  validateReclaim,
  validateTakeDiscard,
} from './moves';
import { openingRequirementFor, TARGET_BY_MODE } from './scoring';
import { DEALER_HAND_SIZE, HAND_SIZE, TOTAL_CARDS } from './cards';
import { buildRamiView } from './view';
import { c, cards, makeTable, playerId } from './testUtils';
import type { GameMode, MeldProposal, RamiState } from './types';

/* ------------------------------------------------------------------ */
/* Aides                                                               */
/* ------------------------------------------------------------------ */

function ids(spec: string): string[] {
  return cards(spec).map((card) => card.id);
}

function run(spec: string): MeldProposal {
  return { kind: 'run', cardIds: ids(spec) };
}

function set(spec: string): MeldProposal {
  return { kind: 'set', cardIds: ids(spec) };
}

function seated(mode: GameMode): RamiState {
  let state = createGame({ settings: { mode }, seed: 7 });
  for (let i = 0; i < requiredPlayers(mode); i++) {
    state = addPlayer(state, { id: `p${i}`, name: `J${i}`, avatar: '🦊' });
  }
  return state;
}

/** Lance la partie et franchit l'animation de distribution. */
function launched(mode: GameMode): RamiState {
  const state = seated(mode);
  const started = reduce(state, { type: 'start_game', playerId: 'p0' }, 1000);
  return tick(started.state, 1000 + DEAL_MS).state;
}

/* ------------------------------------------------------------------ */
/* Modes et mise en place                                              */
/* ------------------------------------------------------------------ */

describe('modes de jeu', () => {
  it('impose 2, 3 ou 4 joueurs et la bonne cible', () => {
    expect(requiredPlayers('1v1')).toBe(2);
    expect(requiredPlayers('1v1v1')).toBe(3);
    expect(requiredPlayers('2v2')).toBe(4);
    expect(TARGET_BY_MODE['1v1']).toBe(401);
    expect(TARGET_BY_MODE['1v1v1']).toBe(601);
    expect(TARGET_BY_MODE['2v2']).toBe(601);
  });

  it('n’autorise le lancement qu’à table complète', () => {
    let state = createGame({ settings: { mode: '1v1v1' } });
    state = addPlayer(state, { id: 'a', name: 'A', avatar: '🦊' });
    expect(canStart(state)).toBe(false);
    state = addPlayer(state, { id: 'b', name: 'B', avatar: '🐻' });
    expect(canStart(state)).toBe(false);
    state = addPlayer(state, { id: 'd', name: 'D', avatar: '🦉' });
    expect(canStart(state)).toBe(true);
  });

  it('place les partenaires face à face en 2 vs 2, et personne ailleurs', () => {
    const duo = seated('2v2');
    expect(duo.players.map((p) => p.teamId)).toEqual([0, 1, 0, 1]);
    expect(duo.teams).toHaveLength(2);

    const solo = seated('1v1v1');
    expect(solo.players.map((p) => p.teamId)).toEqual([0, 1, 2]);
    expect(solo.teams).toHaveLength(3);
  });

  it('libère les places en trop quand le mode se resserre', () => {
    let state = seated('2v2');
    state = setMode(state, '1v1');
    expect(state.players).toHaveLength(2);
    expect(state.settings.targetScore).toBe(401);
  });
});

/* ------------------------------------------------------------------ */
/* Distribution                                                        */
/* ------------------------------------------------------------------ */

describe('distribution', () => {
  it('donne 14 cartes à chacun et 15 au donneur', () => {
    const state = launched('2v2');
    const dealer = state.players.find((p) => p.id === state.dealerId);
    expect(dealer?.hand).toHaveLength(DEALER_HAND_SIZE);
    for (const player of state.players) {
      if (player.id === state.dealerId) continue;
      expect(player.hand).toHaveLength(HAND_SIZE);
    }
  });

  it('conserve les 108 cartes entre les mains, la pioche et la défausse', () => {
    const state = launched('2v2');
    const inHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
    expect(inHands + state.stock.length + state.discard.length).toBe(TOTAL_CARDS);
  });

  it('fait entamer le donneur sans pioche, et il doit jeter', () => {
    const state = launched('1v1');
    expect(state.currentPlayerId).toBe(state.dealerId);
    expect(state.turn?.stage).toBe('meld');
    expect(state.turn?.isDealerOpening).toBe(true);
    expect(state.discard).toHaveLength(0);

    // Piocher est impossible : il a déjà sa quinzième carte.
    const drawn = reduce(state, { type: 'draw_stock', playerId: state.dealerId! }, 0);
    expect(drawn.state.version).toBe(state.version);

    // Sa défausse crée la première carte visible.
    const dealer = state.players.find((p) => p.id === state.dealerId)!;
    const after = reduce(
      state,
      { type: 'discard', playerId: dealer.id, cardId: dealer.hand[0].id },
      0,
    );
    expect(after.state.discard).toHaveLength(1);
    expect(after.state.currentPlayerId).not.toBe(dealer.id);
    expect(after.state.turn?.stage).toBe('draw');
  });

  it('fait tourner le donneur à chaque manche', () => {
    const first = launched('1v1v1');
    const second = tick(startRound(first, 0).state, DEAL_MS).state;
    expect(second.dealerId).not.toBe(first.dealerId);
  });
});

/* ------------------------------------------------------------------ */
/* Ouverture                                                           */
/* ------------------------------------------------------------------ */

describe('ouverture', () => {
  // Tierce ♥10-♥V-♥D-♥R-♥A = 51 points · carré de 5 = 20 points → 71 pile.
  const OPENING_71 = [run('H10 HV HD HR HA'), set('S5 H5 D5 C5')];
  const HAND_71 = 'H10 HV HD HR HA S5 H5 D5 C5 S2 S3';

  it('accepte une ouverture de 71 points pile', () => {
    const state = makeTable({ hands: [HAND_71, 'S7 S8 S9'], current: 0 });
    const check = validateLayMelds(state, 'p0', OPENING_71);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.points).toBe(71);
    expect(check.isOpening).toBe(true);

    const after = reduce(state, { type: 'lay_melds', playerId: 'p0', melds: OPENING_71 }, 0);
    expect(after.state.teams[0].opening).toEqual({ opened: true, score: 71, byId: 'p0' });
    expect(after.state.players[0].hasEntered).toBe(true);
    expect(after.state.melds).toHaveLength(2);
  });

  it('refuse une ouverture de 70 points', () => {
    // Tierce ♠V-♠D-♠R = 30 · carré de 10 = 40 → 70, un point de trop peu.
    const state = makeTable({
      hands: ['SV SD SR S10 H10 D10 C10 H2 H3', 'S7 S8 S9'],
      current: 0,
    });
    const check = validateLayMelds(state, 'p0', [
      run('SV SD SR'),
      set('S10 H10 D10 C10'),
    ]);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain('71');
  });

  it('accepte un joker pour atteindre le seuil', () => {
    // ♥V-♥D-♥R-♥A = 41 (vraies cartes) · ♠10 ♥10 JOKER = 30 → 71.
    const state = makeTable({
      hands: ['HV HD HR HA S10 H10 X H2 H3', 'S7 S8 S9'],
      current: 0,
    });
    const check = validateLayMelds(state, 'p0', [
      run('HV HD HR HA'),
      set('S10 H10 X'),
    ]);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.points).toBe(71);
  });

  it('exige une tierce de trois vraies cartes dans l’ouverture', () => {
    // 71 points atteints, mais la seule tierce contient un joker.
    const state = makeTable({
      hands: ['H10 HV X HR HA S5 H5 D5 C5 S2 S3', 'S7 S8 S9'],
      current: 0,
    });
    const check = validateLayMelds(state, 'p0', [
      run('H10 HV X HD'),
      set('S5 H5 D5 C5'),
    ]);
    expect(check.ok).toBe(false);
  });

  it('refuse d’ouvrir avec des brelans seuls, sans tierce', () => {
    const state = makeTable({
      hands: ['SA HA DA CA SR HR DR CR S2', 'S7 S8 S9'],
      current: 0,
    });
    // 44 + 40 = 84 points, mais aucune tierce.
    const check = validateLayMelds(state, 'p0', [set('SA HA DA CA'), set('SR HR DR CR')]);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain('tierce');
  });

  it('impose 72 à la seconde équipe quand la première a ouvert à 71', () => {
    const state = makeTable({
      hands: ['S2', 'S10 SV SD SR SA D7 H7 C7 H2', 'S3', 'S4'],
      mode: '2v2',
      openings: { 0: 71 },
      entered: [0],
      current: 1,
    });
    const requirement = openingRequirementFor(state, state.players[1]);
    expect(requirement?.points).toBe(72);

    // ♠10-♠V-♠D-♠R-♠A = 51 · brelan de 7 = 21 → 72 pile.
    const check = validateLayMelds(state, 'p1', [
      run('S10 SV SD SR SA'),
      set('D7 H7 C7'),
    ]);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.points).toBe(72);
  });

  it('refuse 71 à la seconde équipe quand la première a ouvert à 71', () => {
    const state = makeTable({
      hands: ['S2', 'H10 HV HD HR HA S5 H5 D5 C5 H2', 'S3', 'S4'],
      mode: '2v2',
      openings: { 0: 71 },
      entered: [0],
      current: 1,
    });
    const check = validateLayMelds(state, 'p1', [
      run('H10 HV HD HR HA'),
      set('S5 H5 D5 C5'),
    ]);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain('72');
  });

  it('impose 120 après une ouverture à 119', () => {
    const state = makeTable({
      hands: ['S2', 'S9 S10 SV SD SR SA DR HR CR DD HD CD H2', 'S3', 'S4'],
      mode: '2v2',
      openings: { 0: 119 },
      entered: [0],
      current: 1,
    });
    expect(openingRequirementFor(state, state.players[1])?.points).toBe(120);

    // ♠9→♠A = 60 · brelan de rois = 30 · brelan de dames = 30 → 120 pile.
    const check = validateLayMelds(state, 'p1', [
      run('S9 S10 SV SD SR SA'),
      set('DR HR CR'),
      set('DD HD CD'),
    ]);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.points).toBe(120);
  });

  it('laisse le partenaire poser une simple tierce', () => {
    const state = makeTable({
      hands: ['S2', 'S3', 'H5 H6 H7 H2', 'S4'],
      mode: '2v2',
      openings: { 0: 71 },
      entered: [0],
      current: 2,
    });
    const requirement = openingRequirementFor(state, state.players[2]);
    expect(requirement?.points).toBe(0);
    expect(requirement?.requiresRun).toBe(true);

    const check = validateLayMelds(state, 'p2', [run('H5 H6 H7')]);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.isOpening).toBe(false);
  });

  it('refuse au partenaire un simple brelan sans tierce', () => {
    const state = makeTable({
      hands: ['S2', 'S3', 'S7 H7 D7 H2', 'S4'],
      mode: '2v2',
      openings: { 0: 71 },
      entered: [0],
      current: 2,
    });
    const check = validateLayMelds(state, 'p2', [set('S7 H7 D7')]);
    expect(check.ok).toBe(false);
  });

  it('n’allège rien pour un adversaire : chaque équipe a son seuil', () => {
    const state = makeTable({
      hands: ['S2', 'H5 H6 H7 H2', 'S3', 'S4'],
      mode: '2v2',
      openings: { 0: 71 },
      entered: [0],
      current: 1,
    });
    const check = validateLayMelds(state, 'p1', [run('H5 H6 H7')]);
    expect(check.ok).toBe(false);
  });

  it('en 1 vs 1, chaque joueur ouvre pour lui-même', () => {
    const state = makeTable({ hands: ['H5 H6 H7 H2', 'S2 S3 S4'], current: 0 });
    expect(openingRequirementFor(state, state.players[0])?.points).toBe(71);
    const check = validateLayMelds(state, 'p0', [run('H5 H6 H7')]);
    expect(check.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Pioche et reprise dans la défausse                                  */
/* ------------------------------------------------------------------ */

describe('pioche et défausse', () => {
  it('permet de piocher au talon puis de jeter', () => {
    const state = makeTable({
      hands: ['H5 H6 H7', 'S2 S3 S4'],
      stock: 'D9 D10',
      discard: 'C2',
      current: 0,
      stage: 'draw',
    });
    const drawn = reduce(state, { type: 'draw_stock', playerId: 'p0' }, 0);
    expect(drawn.state.players[0].hand).toHaveLength(4);
    expect(drawn.state.stock).toHaveLength(1);
    expect(drawn.state.turn?.stage).toBe('meld');

    const discarded = reduce(
      drawn.state,
      { type: 'discard', playerId: 'p0', cardId: c('H5').id },
      0,
    );
    expect(discarded.state.currentPlayerId).toBe('p1');
    expect(discarded.state.discard.at(-1)?.id).toBe(c('H5').id);
  });

  it('exige que la carte reprise dans la défausse serve immédiatement', () => {
    const state = makeTable({
      hands: ['H8 H9 H10 S2', 'S3 S4 S5'],
      stock: 'D9 D10',
      discard: 'H7',
      current: 0,
      stage: 'draw',
      openings: { 0: 71 },
      entered: [0],
    });

    const taken = reduce(state, { type: 'take_discard', playerId: 'p0' }, 0);
    expect(taken.state.turn?.takenCardId).toBe(c('H7').id);
    expect(taken.state.discard).toHaveLength(0);

    // Impossible de la garder : la défausse d'une autre carte est refusée.
    const refused = validateDiscard(taken.state, 'p0', c('S2').id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toContain('immédiatement');

    // Posée dans une tierce, la carte est bien utilisée.
    const laid = reduce(
      taken.state,
      { type: 'lay_melds', playerId: 'p0', melds: [run('H7 H8 H9 H10')] },
      0,
    );
    expect(laid.state.turn?.takenCardUsed).toBe(true);
    const allowed = validateDiscard(laid.state, 'p0', c('S2').id);
    expect(allowed.ok).toBe(true);
  });

  it('permet de remettre la carte reprise à sa place', () => {
    const state = makeTable({
      hands: ['H8 H9 S2', 'S3 S4 S5'],
      stock: 'D9',
      discard: 'C2 H7',
      current: 0,
      stage: 'draw',
    });
    const taken = reduce(state, { type: 'take_discard', playerId: 'p0' }, 0);
    const back = reduce(taken.state, { type: 'cancel_take', playerId: 'p0' }, 0);
    expect(back.state.discard.at(-1)?.id).toBe(c('H7').id);
    expect(back.state.turn?.stage).toBe('draw');
    expect(back.state.players[0].hand).toHaveLength(3);
  });

  it('refuse la reprise quand la défausse est vide', () => {
    const state = makeTable({
      hands: ['H8 H9 S2', 'S3 S4 S5'],
      stock: 'D9',
      current: 0,
      stage: 'draw',
    });
    expect(validateTakeDiscard(state, 'p0').ok).toBe(false);
  });

  it('impose toujours une défausse pour finir son tour', () => {
    const state = makeTable({
      hands: ['H8 H9 S2', 'S3 S4 S5'],
      stock: 'D9',
      current: 0,
      stage: 'draw',
    });
    const drawn = reduce(state, { type: 'draw_stock', playerId: 'p0' }, 0);
    // Sans défausse, la main ne change pas de joueur.
    expect(drawn.state.currentPlayerId).toBe('p0');
  });
});

/* ------------------------------------------------------------------ */
/* Recyclage                                                           */
/* ------------------------------------------------------------------ */

describe('pioche vide', () => {
  it('recycle la défausse en gardant la dernière carte jetée visible', () => {
    const state = makeTable({
      hands: ['H8 H9 HR', 'S3 S4 S5'],
      stock: '',
      discard: 'S2 S6 S7',
      current: 0,
      stage: 'meld',
    });
    const after = reduce(state, { type: 'discard', playerId: 'p0', cardId: c('HR').id }, 0);
    expect(after.state.discard).toHaveLength(1);
    expect(after.state.discard[0].id).toBe(c('HR').id);
    expect(after.state.stock).toHaveLength(3);
    expect(after.state.recycles).toBe(1);
    // Aucune carte n'est perdue au recyclage.
    expect(
      after.state.stock.map((card) => card.id).sort(),
    ).toEqual(cards('S2 S6 S7').map((card) => card.id).sort());
  });

  it('ne perd aucune carte et laisse la partie continuer', () => {
    const state = makeTable({
      hands: ['H8 H9 HR', 'S3 S4 S5'],
      stock: '',
      discard: 'S2 S6 S7',
      current: 0,
    });
    const after = reduce(state, { type: 'discard', playerId: 'p0', cardId: c('HR').id }, 0);
    expect(after.state.phase).toBe('playing');
    expect(after.state.currentPlayerId).toBe('p1');
    expect(after.state.turn?.stage).toBe('draw');
  });
});

/* ------------------------------------------------------------------ */
/* Compléter, réorganiser, jokers sur la table                         */
/* ------------------------------------------------------------------ */

describe('combinaisons sur la table', () => {
  it('complète une tierce de son équipe', () => {
    const state = makeTable({
      hands: ['H4 H9 H10 S2', 'S3 S4 S5'],
      melds: [{ by: 0, cards: 'H5 H6 H7 H8' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    const check = validateExtend(state, 'p0', 't0', ids('H4 H9 H10'));
    expect(check.ok).toBe(true);

    const after = reduce(
      state,
      { type: 'extend_meld', playerId: 'p0', meldId: 't0', cardIds: ids('H4 H9 H10') },
      0,
    );
    expect(after.state.melds[0].slots).toHaveLength(7);
    expect(after.state.players[0].hand).toHaveLength(1);
  });

  it('interdit toute réorganisation : aucune carte posée ne bouge', () => {
    const state = makeTable({
      hands: ["H6' H10 S2", 'S3 S4 S5'],
      melds: [{ by: 0, cards: 'H5 H6 H7' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    // Un doublon ne s'insère pas.
    expect(validateExtend(state, 'p0', 't0', ids("H6'")).ok).toBe(false);
    // Une carte à distance ne s'insère pas non plus : pas de trou, pas de fusion.
    expect(validateExtend(state, 'p0', 't0', ids('H10')).ok).toBe(false);
    // Et le moteur n'expose aucune action de retrait ou de fusion :
    // seul le remplacement d'un joker sort une carte d'une combinaison.
    expect(validateReclaim(state, 'p0', 't0', ids('H10')).ok).toBe(false);
  });

  it('exige d’avoir posé avant de compléter la table', () => {
    const state = makeTable({
      hands: ['H4 H9 S2', 'S3 S4 S5'],
      melds: [{ by: 1, cards: 'H5 H6 H7 H8' }],
      openings: { 1: 71 },
      entered: [1],
      current: 0,
    });
    const check = validateExtend(state, 'p0', 't0', ids('H4'));
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.message).toContain('première combinaison');
  });

  it('n’ouvre les combinaisons adverses qu’après toutes les ouvertures', () => {
    const closed = makeTable({
      hands: ['S2', 'H4 H9 S3', 'S4', 'S5'],
      mode: '2v2',
      melds: [{ by: 0, cards: 'H5 H6 H7 H8' }],
      openings: { 0: 71 },
      entered: [0, 1],
      current: 1,
    });
    expect(validateExtend(closed, 'p1', 't0', ids('H4')).ok).toBe(false);

    const open = makeTable({
      hands: ['S2', 'H4 H9 S3', 'S4', 'S5'],
      mode: '2v2',
      melds: [{ by: 0, cards: 'H5 H6 H7 H8' }],
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
      current: 1,
    });
    expect(validateExtend(open, 'p1', 't0', ids('H4')).ok).toBe(true);
  });

  it('récupère le joker d’une tierce avec la carte exacte', () => {
    const state = makeTable({
      hands: ['H7 S2 S3', 'S4 S5 S6'],
      melds: [{ by: 0, cards: 'H5 H6 X H8' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    const after = reduce(
      state,
      { type: 'reclaim_joker', playerId: 'p0', meldId: 't0', cardIds: ids('H7') },
      0,
    );
    expect(after.state.melds[0].slots.some((slot) => slot.card.joker)).toBe(false);
    expect(after.state.players[0].hand.some((card) => card.joker)).toBe(true);
    expect(after.state.players[0].hand).toHaveLength(3);
  });

  it('refuse un sept d’un autre signe pour ce joker', () => {
    const state = makeTable({
      hands: ['S7 S2 S3', 'S4 S5 S6'],
      melds: [{ by: 0, cards: 'H5 H6 X H8' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    expect(validateReclaim(state, 'p0', 't0', ids('S7')).ok).toBe(false);
  });

  it('récupère le joker d’un brelan avec les deux cartes manquantes', () => {
    const state = makeTable({
      hands: ['D8 C8 S2 S3', 'S4 S5 S6'],
      melds: [{ by: 0, kind: 'set', cards: 'S8 H8 X' }],
      openings: { 0: 71 },
      entered: [0],
      current: 0,
    });
    expect(validateReclaim(state, 'p0', 't0', ids('D8')).ok).toBe(false);

    const after = reduce(
      state,
      { type: 'reclaim_joker', playerId: 'p0', meldId: 't0', cardIds: ids('D8 C8') },
      0,
    );
    expect(after.state.melds[0].slots).toHaveLength(4);
    expect(after.state.melds[0].slots.some((slot) => slot.card.joker)).toBe(false);
    expect(after.state.players[0].hand.filter((card) => card.joker)).toHaveLength(1);
  });

  it('permet de récupérer un joker adverse après les ouvertures', () => {
    const state = makeTable({
      hands: ['S2', 'H7 S3 S4', 'S5', 'S6'],
      mode: '2v2',
      melds: [{ by: 0, cards: 'H5 H6 X H8' }],
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
      current: 1,
    });
    const check = validateReclaim(state, 'p1', 't0', ids('H7'));
    expect(check.ok).toBe(true);

    const after = reduce(
      state,
      { type: 'reclaim_joker', playerId: 'p1', meldId: 't0', cardIds: ids('H7') },
      0,
    );
    expect(after.events[0]).toMatchObject({ type: 'joker_reclaimed', fromOpponent: true });
  });

  it('interdit de récupérer un joker adverse avant d’avoir ouvert', () => {
    const state = makeTable({
      hands: ['S2', 'H7 S3 S4', 'S5', 'S6'],
      mode: '2v2',
      melds: [{ by: 0, cards: 'H5 H6 X H8' }],
      openings: { 0: 71 },
      entered: [0],
      current: 1,
    });
    expect(validateReclaim(state, 'p1', 't0', ids('H7')).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Finir une manche                                                    */
/* ------------------------------------------------------------------ */

describe('finir une manche', () => {
  it('interdit de tout poser sans garder de carte à jeter', () => {
    // Main 6-8-9, carte reprise 7 : poser 6-7-8-9 ne laisse rien à jeter.
    const state = makeTable({
      hands: ['H6 H8 H9', 'S3 S4 S5'],
      discard: 'H7',
      stock: 'D2',
      current: 0,
      stage: 'draw',
      openings: { 0: 71 },
      entered: [0],
    });
    const taken = reduce(state, { type: 'take_discard', playerId: 'p0' }, 0);
    const all = validateLayMelds(taken.state, 'p0', [run('H6 H7 H8 H9')]);
    expect(all.ok).toBe(false);
    if (!all.ok) expect(all.message).toContain('conserver une carte');

    // En revanche, 6-7-8 puis jeter le 9 est correct.
    const three = reduce(
      taken.state,
      { type: 'lay_melds', playerId: 'p0', melds: [run('H6 H7 H8')] },
      0,
    );
    expect(three.state.players[0].hand).toHaveLength(1);
    const finish = reduce(
      three.state,
      { type: 'discard', playerId: 'p0', cardId: c('H9').id },
      0,
    );
    expect(finish.state.phase).toBe('round_end');
    expect(finish.state.lastSummary?.winnerId).toBe('p0');
  });

  it('accepte aussi 7-8-9 puis jeter le 6', () => {
    const state = makeTable({
      hands: ['H6 H8 H9', 'S3 S4 S5'],
      discard: 'H7',
      stock: 'D2',
      current: 0,
      stage: 'draw',
      openings: { 0: 71 },
      entered: [0],
    });
    const taken = reduce(state, { type: 'take_discard', playerId: 'p0' }, 0);
    const laid = reduce(
      taken.state,
      { type: 'lay_melds', playerId: 'p0', melds: [run('H7 H8 H9')] },
      0,
    );
    const finish = reduce(
      laid.state,
      { type: 'discard', playerId: 'p0', cardId: c('H6').id },
      0,
    );
    expect(finish.state.lastSummary?.winnerId).toBe('p0');
  });
});

/* ------------------------------------------------------------------ */
/* Score                                                               */
/* ------------------------------------------------------------------ */

describe('score de fin de manche', () => {
  function finishRound(state: RamiState, winnerSeat: number, discardId: string) {
    return reduce(
      state,
      { type: 'discard', playerId: playerId(state, winnerSeat), cardId: discardId },
      0,
    ).state;
  }

  it('donne 0 au gagnant, 100 à qui n’a jamais posé', () => {
    const state = makeTable({
      hands: ['HR', 'S3 S4 S5 SA'],
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71 },
      entered: [0],
    });
    const after = finishRound(state, 0, c('HR').id);
    const summary = after.lastSummary!;
    expect(summary.winnerId).toBe('p0');
    expect(summary.players[0].points).toBe(0);
    expect(summary.players[1].neverMelded).toBe(true);
    expect(summary.players[1].points).toBe(100);
  });

  it('compte les cartes restantes d’un joueur qui a posé', () => {
    // 8 + Roi + As + Joker = 8 + 10 + 11 + 25 = 54 points.
    const state = makeTable({
      hands: ['HR', 'H8 SR SA X'],
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
    });
    const after = finishRound(state, 0, c('HR').id);
    const summary = after.lastSummary!;
    expect(summary.players[1].neverMelded).toBe(false);
    // Main triée : joker, puis pique (As, Roi), puis cœur.
    expect(summary.players[1].breakdown).toEqual([25, 11, 10, 8]);
    expect(summary.players[1].points).toBe(54);
  });

  it('donne 0 aux deux joueurs de l’équipe gagnante en 2 vs 2', () => {
    const state = makeTable({
      hands: ['HR', 'S3 S4', 'D5 D6 DA', 'C7 C8'],
      mode: '2v2',
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1, 3],
    });
    const after = finishRound(state, 0, c('HR').id);
    const summary = after.lastSummary!;
    // Sièges 0 et 2 forment l'équipe 0.
    expect(summary.players[0].points).toBe(0);
    expect(summary.players[2].points).toBe(0);
    expect(summary.players[2].remaining).toHaveLength(3);
    expect(summary.teams.find((team) => team.teamId === 0)?.points).toBe(0);
  });

  it('additionne les deux perdants d’une équipe', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR', 'D5 D6', 'C7 SA'],
      mode: '2v2',
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1, 2, 3],
    });
    const after = finishRound(state, 0, c('HR').id);
    const team1 = after.lastSummary!.teams.find((team) => team.teamId === 1)!;
    // Siège 1 : 8 + 10 = 18 · siège 3 : 7 + 11 = 18 → 36.
    expect(team1.points).toBe(36);
  });

  it('ajoute les points au cumul de l’équipe', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR'],
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
      teamScores: { 0: 40, 1: 120 },
    });
    const after = finishRound(state, 0, c('HR').id);
    expect(after.teams[0].score).toBe(40);
    expect(after.teams[1].score).toBe(138);
    expect(after.phase).toBe('round_end');
  });
});

describe('fin de partie', () => {
  it('perd à 401 en 1 vs 1', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR'],
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
      teamScores: { 0: 10, 1: 383 },
    });
    const after = reduce(
      state,
      { type: 'discard', playerId: 'p0', cardId: c('HR').id },
      0,
    ).state;
    expect(after.teams[1].score).toBe(401);
    expect(after.phase).toBe('game_over');
    expect(after.outcome?.loserTeamIds).toEqual([1]);
    expect(after.outcome?.winnerTeamId).toBe(0);
  });

  it('ne termine pas la partie sous le seuil', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR'],
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
      teamScores: { 0: 10, 1: 380 },
    });
    const after = reduce(
      state,
      { type: 'discard', playerId: 'p0', cardId: c('HR').id },
      0,
    ).state;
    expect(after.teams[1].score).toBe(398);
    expect(after.phase).toBe('round_end');
  });

  it('perd à 601 en 2 vs 2', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR', 'D5', 'C7 SA'],
      mode: '2v2',
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1, 2, 3],
      teamScores: { 0: 100, 1: 565 },
    });
    const after = reduce(
      state,
      { type: 'discard', playerId: 'p0', cardId: c('HR').id },
      0,
    ).state;
    // Équipe 1 : (8+10) + (7+11) = 36 → 601.
    expect(after.teams[1].score).toBe(601);
    expect(after.phase).toBe('game_over');
    expect(after.outcome?.loserTeamIds).toEqual([1]);
  });

  it('perd à 601 en 1 vs 1 vs 1', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR', 'D5 D6'],
      mode: '1v1v1',
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72, 2: 73 },
      entered: [0, 1, 2],
      teamScores: { 0: 0, 1: 583, 2: 100 },
    });
    const after = reduce(
      state,
      { type: 'discard', playerId: 'p0', cardId: c('HR').id },
      0,
    ).state;
    expect(after.settings.targetScore).toBe(601);
    expect(after.teams[1].score).toBe(601);
    expect(after.phase).toBe('game_over');
  });
});

/* ------------------------------------------------------------------ */
/* Nouvelle manche                                                     */
/* ------------------------------------------------------------------ */

describe('nouvelle manche', () => {
  it('redistribue et remet les ouvertures à zéro sans toucher aux scores', () => {
    const state = makeTable({
      hands: ['HR', 'H8 SR'],
      stock: 'D2 D3',
      current: 0,
      openings: { 0: 71, 1: 72 },
      entered: [0, 1],
      teamScores: { 0: 30, 1: 40 },
    });
    const ended = reduce(state, { type: 'discard', playerId: 'p0', cardId: c('HR').id }, 0).state;
    const next = startRound(ended, 0).state;

    expect(next.roundNumber).toBe(2);
    expect(next.teams[0].opening.opened).toBe(false);
    expect(next.teams[1].opening.opened).toBe(false);
    expect(next.teams[0].score).toBe(30);
    expect(next.melds).toHaveLength(0);
    expect(next.discard).toHaveLength(0);
    expect(next.players.every((player) => !player.hasEntered)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Confidentialité et chrono                                           */
/* ------------------------------------------------------------------ */

describe('confidentialité', () => {
  it('ne livre à un joueur que sa propre main', () => {
    const state = launched('2v2');
    const view = buildRamiView(state, 'p1', 0);
    expect(view.hand).toHaveLength(14);
    expect(view.youId).toBe('p1');
    expect(view.players.every((player) => !('hand' in player))).toBe(true);
    expect(JSON.stringify(view.players)).not.toContain('"rank"');
  });

  it('ne révèle jamais le contenu de la pioche', () => {
    const state = launched('1v1');
    const view = buildRamiView(state, 'p0', 0);
    expect(view.stockCount).toBeGreaterThan(0);
    expect(view).not.toHaveProperty('stock');
  });

  it('montre la carte du dessus de la défausse, et elle seule', () => {
    const state = makeTable({
      hands: ['H5 H6', 'S2 S3'],
      discard: 'C2 C3 C4',
      current: 0,
    });
    const view = buildRamiView(state, 'p1', 0);
    expect(view.discardTop?.id).toBe(c('C4').id);
    expect(view.discardCount).toBe(3);
  });
});

describe('chrono', () => {
  it('joue un tour complet à la place d’un joueur qui ne répond pas', () => {
    const state = makeTable({
      hands: ['H5 H6 HR', 'S2 S3'],
      stock: 'D9 D10',
      discard: 'C2',
      current: 0,
      stage: 'draw',
    });
    const withDeadline: RamiState = { ...state, turnDeadline: 100, turnTotalMs: 1000 };
    const after = tick(withDeadline, 200);
    expect(after.events[0]).toMatchObject({ type: 'timeout', playerId: 'p0' });
    expect(after.state.currentPlayerId).toBe('p1');
    expect(after.state.discard).toHaveLength(2);
  });

  it('remet d’abord une carte reprise non utilisée', () => {
    const state = makeTable({
      hands: ['H5 H6 HR H7', 'S2 S3'],
      stock: 'D9 D10',
      discard: 'C2',
      current: 0,
      takenCardId: c('H7').id,
    });
    const withDeadline: RamiState = { ...state, turnDeadline: 100, turnTotalMs: 1000 };
    const after = tick(withDeadline, 200);
    expect(after.state.currentPlayerId).toBe('p1');
    // Le ♥7 est revenu sur la défausse, puis une autre carte a été jetée.
    expect(after.state.discard.map((card) => card.id)).toContain(c('H7').id);
  });

  it('choisit une carte isolée plutôt qu’une amorce de combinaison', () => {
    const hand = cards('H5 H6 H7 SR');
    expect(leastUsefulCard(hand)?.id).toBe(c('SR').id);
  });
});

/* ------------------------------------------------------------------ */
/* Carte reprise dans la défausse                                      */
/* ------------------------------------------------------------------ */

describe('reprendre la défausse pour compléter la table', () => {
  it('accepte de compléter une combinaison posée avec la carte reprise', () => {
    const state = makeTable({
      hands: ['S2 S3 D9', 'C4 C5 C6'],
      discard: 'H9',
      stock: 'D2',
      current: 0,
      stage: 'draw',
      openings: { 0: 71 },
      entered: [0],
      melds: [{ by: 0, cards: 'H6 H7 H8' }],
    });
    const taken = reduce(state, { type: 'take_discard', playerId: 'p0' }, 0);
    expect(taken.state.turn?.takenCardId).toBe(c('H9').id);

    const meldId = taken.state.melds[0].id;
    const extended = reduce(
      taken.state,
      { type: 'extend_meld', playerId: 'p0', meldId, cardIds: [c('H9').id] },
      0,
    );
    expect(extended.state.melds[0].slots).toHaveLength(4);
    // La carte reprise a servi : la défausse est de nouveau permise.
    expect(extended.state.turn?.takenCardUsed).toBe(true);

    const finish = reduce(
      extended.state,
      { type: 'discard', playerId: 'p0', cardId: c('D9').id },
      0,
    );
    expect(finish.state.currentPlayerId).toBe('p1');
  });

  it('refuse de jeter tant que la carte reprise n’a pas servi', () => {
    const state = makeTable({
      hands: ['S2 S3 D9', 'C4 C5 C6'],
      discard: 'H9',
      stock: 'D2',
      current: 0,
      stage: 'draw',
      openings: { 0: 71 },
      entered: [0],
      melds: [{ by: 0, cards: 'H6 H7 H8' }],
    });
    const taken = reduce(state, { type: 'take_discard', playerId: 'p0' }, 0);
    const refus = reduce(
      taken.state,
      { type: 'discard', playerId: 'p0', cardId: c('S2').id },
      0,
    );
    expect(refus.state.players[0].hand).toHaveLength(4);
  });
});
