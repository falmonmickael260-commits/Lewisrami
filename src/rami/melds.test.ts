import { describe, expect, it } from 'vitest';
import {
  buildMeld,
  buildRun,
  buildSet,
  extendMeldWith,
  jokerRequirement,
  meldLabel,
  meldPoints,
  missingSetSuits,
  qualifiesAsOpeningRun,
  reclaimJokerWith,
} from './melds';
import { createDeck, handTotal, TOTAL_CARDS } from './cards';
import { cards, makeTable } from './testUtils';
import type { Meld } from './types';

function meldFrom(spec: string, kind?: 'run' | 'set'): Meld {
  const built = buildMeld({ kind: kind ?? 'run' }, cards(spec), 'p0');
  if (!built.ok) throw new Error(built.message);
  return {
    id: 'm',
    kind: built.kind,
    teamId: 0,
    ownerId: 'p0',
    suit: built.suit,
    rank: built.rank,
    slots: built.slots,
    roundNumber: 1,
  };
}

describe('paquet', () => {
  it('compte 108 cartes : deux jeux de 52 et quatre jokers', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(TOTAL_CARDS);
    expect(deck).toHaveLength(108);
    expect(deck.filter((card) => card.joker)).toHaveLength(4);
    expect(new Set(deck.map((card) => card.id)).size).toBe(108);
  });

  it('conserve deux exemplaires distincts de chaque carte', () => {
    const deck = createDeck();
    const queens = deck.filter((card) => card.rank === 12 && card.suit === 'S');
    expect(queens).toHaveLength(2);
    expect(queens[0].id).not.toBe(queens[1].id);
  });
});

describe('tierce', () => {
  it('accepte trois cartes consécutives de même signe', () => {
    const result = buildRun(cards('H4 H5 H6'), 'p0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('run');
      expect(result.points).toBe(15);
    }
  });

  it('accepte une longue tierce jusqu’à l’As', () => {
    const result = buildRun(cards('H4 H5 H6 H7 H8 H9 H10 HV HD HR HA'), 'p0');
    expect(result.ok).toBe(true);
    // 4+5+6+7+8+9+10 = 49, puis V/D/R = 30, et l'As haut = 11.
    if (result.ok) expect(result.points).toBe(49 + 30 + 11);
  });

  it('refuse une tierce non consécutive', () => {
    const result = buildRun(cards('H5 H7 H8'), 'p0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_consecutive');
  });

  it('refuse une tierce de signes mélangés', () => {
    const result = buildRun(cards('H5 S6 H7'), 'p0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('mixed_suits');
  });

  it('refuse deux cartes de même valeur dans une tierce', () => {
    const result = buildRun(cards("H5 H5' H6"), 'p0');
    expect(result.ok).toBe(false);
  });

  it('refuse moins de trois cartes', () => {
    const result = buildRun(cards('H5 H6'), 'p0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_short');
  });
});

describe('As : 1 ou 11 selon sa position', () => {
  it('vaut 1 dans A-2-3', () => {
    const result = buildRun(cards('HA H2 H3'), 'p0');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toBe(1 + 2 + 3);
  });

  it('vaut 11 dans D-R-A', () => {
    const result = buildRun(cards('HD HR HA'), 'p0');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toBe(10 + 10 + 11);
  });

  it('vaut 11 dans un brelan', () => {
    const result = buildSet(cards('SA HA DA'), 'p0');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toBe(33);
  });

  it('refuse une suite qui ferait le tour (R-A-2)', () => {
    const result = buildRun(cards('HR HA H2'), 'p0');
    expect(result.ok).toBe(false);
  });
});

describe('brelan et carré', () => {
  it('accepte trois signes différents', () => {
    const result = buildSet(cards('S7 H7 D7'), 'p0');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toBe(21);
  });

  it('refuse un brelan avec deux signes identiques', () => {
    const result = buildSet(cards("S7 S7' H7"), 'p0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('duplicate_suit');
  });

  it('refuse un brelan de valeurs différentes', () => {
    const result = buildSet(cards('S7 H8 D7'), 'p0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('mixed_ranks');
  });

  it('accepte un carré des quatre signes', () => {
    const result = buildSet(cards('S7 H7 D7 C7'), 'p0');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.points).toBe(28);
  });

  it('refuse une cinquième carte dans un carré', () => {
    const result = buildSet(cards("S7 H7 D7 C7 S7'"), 'p0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('set_too_large');
  });
});

describe('jokers', () => {
  it('refuse deux jokers dans une même combinaison', () => {
    const run = buildRun(cards('H5 H6 X X1'), 'p0');
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.reason).toBe('too_many_jokers');

    const set = buildSet(cards('S7 H7 X X1'), 'p0');
    expect(set.ok).toBe(false);
    if (!set.ok) expect(set.reason).toBe('too_many_jokers');
  });

  it('bouche un trou intérieur et prend la valeur de la carte représentée', () => {
    const result = buildRun(cards('H5 H6 X H8'), 'p0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const joker = result.slots.find((slot) => slot.card.joker);
    expect(joker?.jokerRole).toEqual({ rank: 7, suit: 'H', runValue: 7 });
    // 5 + 6 + 7 (joker) + 8
    expect(result.points).toBe(26);
  });

  it('vaut 10 lorsqu’il représente un roi', () => {
    const result = buildRun(cards('HV HD X HA'), 'p0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const joker = result.slots.find((slot) => slot.card.joker);
    expect(joker?.jokerRole?.rank).toBe(13);
    expect(result.points).toBe(10 + 10 + 10 + 11);
  });

  it('prolonge une extrémité selon l’ordre choisi par le joueur', () => {
    const high = buildRun(cards('H5 H6 H7 X'), 'p0');
    expect(high.ok).toBe(true);
    if (high.ok) {
      expect(high.slots[3].jokerRole?.rank).toBe(8);
    }
    const low = buildRun(cards('X H5 H6 H7'), 'p0');
    expect(low.ok).toBe(true);
    if (low.ok) {
      expect(low.slots[0].jokerRole?.rank).toBe(4);
    }
  });

  it('dans un brelan, ne fixe que la valeur', () => {
    const result = buildSet(cards('S8 H8 X'), 'p0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const joker = result.slots.find((slot) => slot.card.joker);
    expect(joker?.jokerRole).toEqual({ rank: 8, suit: null, runValue: null });
    expect(result.points).toBe(24);
  });

  it('une tierce de trois cartes dont un joker ne peut pas servir d’ouverture', () => {
    const withJoker = meldFrom('H5 H6 X');
    expect(withJoker.slots).toHaveLength(3);
    expect(qualifiesAsOpeningRun(withJoker)).toBe(false);

    const real = meldFrom('H5 H6 H7');
    expect(qualifiesAsOpeningRun(real)).toBe(true);

    // Quatre cartes dont un joker : il reste bien trois vraies cartes.
    const four = meldFrom('H5 H6 X H8');
    expect(qualifiesAsOpeningRun(four)).toBe(true);
  });
});

describe('compléter une combinaison', () => {
  it('prolonge une tierce par ses deux extrémités', () => {
    const meld = meldFrom('H5 H6 H7 H8');
    const result = extendMeldWith(meld, cards('H4 H9 H10'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots.map((slot) => slot.runValue)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(result.addedPoints).toBe(4 + 9 + 10);
  });

  it('refuse une carte d’un autre signe', () => {
    const meld = meldFrom('H5 H6 H7');
    const result = extendMeldWith(meld, cards('S8'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_suit');
  });

  it('refuse une carte qui laisserait un trou', () => {
    const meld = meldFrom('H5 H6 H7');
    const result = extendMeldWith(meld, cards('H10'));
    expect(result.ok).toBe(false);
  });

  it('refuse un doublon : on ne réorganise jamais une combinaison posée', () => {
    const meld = meldFrom('H5 H6 H7');
    const result = extendMeldWith(meld, cards("H6'"));
    expect(result.ok).toBe(false);
  });

  it('complète un brelan en carré, une enseigne à la fois', () => {
    const meld = meldFrom('S7 H7 D7', 'set');
    expect(missingSetSuits(meld)).toEqual(['C']);
    const result = extendMeldWith(meld, cards('C7'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slots).toHaveLength(4);
  });

  it('refuse une cinquième carte dans un carré complet', () => {
    const meld = meldFrom('S7 H7 D7 C7', 'set');
    const result = extendMeldWith(meld, cards("S7'"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('set_full');
  });

  it('refuse un second joker dans une combinaison qui en a déjà un', () => {
    const meld = meldFrom('H5 H6 X H8');
    const result = extendMeldWith(meld, cards('X1'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too_many_jokers');
  });
});

describe('récupération d’un joker', () => {
  it('dans une tierce : il faut la carte exacte', () => {
    const meld = meldFrom('H5 H6 X H8');
    expect(jokerRequirement(meld)).toEqual({ rank: 7, suits: ['H'] });

    const wrong = reclaimJokerWith(meld, cards('S7'));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe('wrong_card');

    const right = reclaimJokerWith(meld, cards('H7'));
    expect(right.ok).toBe(true);
    if (!right.ok) return;
    expect(right.joker.joker).toBe(true);
    expect(right.slots.map((slot) => slot.card.id)).toEqual(
      cards('H5 H6 H7 H8').map((card) => card.id),
    );
  });

  it('dans un brelan : il faut toutes les cartes manquantes', () => {
    const meld = meldFrom('S8 H8 X', 'set');
    expect(jokerRequirement(meld)).toEqual({ rank: 8, suits: ['D', 'C'] });

    const single = reclaimJokerWith(meld, cards('D8'));
    expect(single.ok).toBe(false);
    if (!single.ok) expect(single.reason).toBe('missing_cards');

    const both = reclaimJokerWith(meld, cards('D8 C8'));
    expect(both.ok).toBe(true);
    if (both.ok) expect(both.slots).toHaveLength(4);
  });

  it('refuse un joker pour remplacer un joker', () => {
    const meld = meldFrom('H5 H6 X H8');
    const result = reclaimJokerWith(meld, cards('X1'));
    expect(result.ok).toBe(false);
  });

  it('refuse sur une combinaison sans joker', () => {
    const meld = meldFrom('H5 H6 H7');
    const result = reclaimJokerWith(meld, cards('H8'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_joker');
  });
});

describe('points', () => {
  it('compte une main selon le barème : joker 25, As 11, figures 10', () => {
    expect(handTotal(cards('H8 HR HA X'))).toBe(8 + 10 + 11 + 25);
    expect(handTotal(cards('H8 HR HA X'))).toBe(54);
  });

  it('compte une combinaison posée, joker à la valeur représentée', () => {
    expect(meldPoints(meldFrom('H5 H6 X H8'))).toBe(26);
    expect(meldPoints(meldFrom('S7 H7 X', 'set'))).toBe(21);
  });
});

describe('libellés', () => {
  it('nomme les combinaisons en français', () => {
    expect(meldLabel(meldFrom('S7 H7 D7', 'set'))).toBe('brelan de sept');
    expect(meldLabel(meldFrom('S7 H7 D7 C7', 'set'))).toBe('carré de sept');
    expect(meldLabel(meldFrom('H5 H6 H7'))).toBe('tierce à cœur, du cinq au sept');
  });
});

describe('table de test', () => {
  it('fabrique une situation exploitable', () => {
    const state = makeTable({
      hands: ['H5 H6 H7', 'S2 S3 S4'],
      melds: [{ by: 0, cards: 'D5 D6 D7' }],
      openings: { 0: 71 },
      entered: [0],
    });
    expect(state.players).toHaveLength(2);
    expect(state.melds).toHaveLength(1);
    expect(state.teams[0].opening.opened).toBe(true);
  });
});
