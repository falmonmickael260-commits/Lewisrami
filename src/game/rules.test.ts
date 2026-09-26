import { describe, expect, it } from 'vitest';
import { createDeck, deal, sortHand } from './cards';
import { canBeat, getCombo, legalCombos, validatePlay } from './rules';
import { cards, playingGame } from './testUtils';

describe('paquet et distribution', () => {
  it('contient 52 cartes uniques, sans joker', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it('distribue aussi équitablement que possible', () => {
    for (let players = 3; players <= 8; players++) {
      const hands = deal(createDeck(), players);
      const sizes = hands.map((h) => h.length);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(52);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(new Set(hands.flat().map((c) => c.id)).size).toBe(52);
    }
  });

  it('trie la main du plus faible (3) au plus fort (2)', () => {
    const hand = sortHand(cards('15H', '3S', '14D', '12C'));
    expect(hand.map((c) => c.id)).toEqual(['3S', '12C', '14D', '15H']);
  });
});

describe('combinaisons', () => {
  it('reconnaît simple, paire, brelan et carré', () => {
    expect(getCombo(cards('7H'))?.kind).toBe('single');
    expect(getCombo(cards('9H', '9S'))?.kind).toBe('pair');
    expect(getCombo(cards('12H', '12S', '12D'))?.kind).toBe('triple');
    expect(getCombo(cards('5H', '5S', '5D', '5C'))?.kind).toBe('quad');
  });

  it('refuse les valeurs mélangées et les sélections vides ou trop grandes', () => {
    expect(getCombo(cards('7H', '8S'))).toBeNull();
    expect(getCombo([])).toBeNull();
    expect(getCombo(cards('5H', '5S', '5D', '5C', '6H'))).toBeNull();
  });
});

describe('supériorité', () => {
  it('impose le même nombre de cartes', () => {
    const king = getCombo(cards('13H'))!;
    expect(canBeat(king, { rank: 8, count: 2 }, true)).toBe(false);
  });

  it('accepte une paire plus forte', () => {
    const tens = getCombo(cards('10H', '10S'))!;
    expect(canBeat(tens, { rank: 8, count: 2 }, true)).toBe(true);
  });

  it('classe le 2 au-dessus de l’as', () => {
    const two = getCombo(cards('15H'))!;
    const ace = getCombo(cards('14H'))!;
    expect(canBeat(two, { rank: 14, count: 1 }, false)).toBe(true);
    expect(canBeat(ace, { rank: 15, count: 1 }, false)).toBe(false);
  });

  it('refuse la valeur égale quand le réglage l’interdit', () => {
    const combo = getCombo(cards('8D'))!;
    expect(canBeat(combo, { rank: 8, count: 1 }, false)).toBe(false);
    expect(canBeat(combo, { rank: 8, count: 1 }, true)).toBe(true);
  });
});

describe('validation centrale', () => {
  it('refuse de jouer hors de son tour', () => {
    const state = playingGame({ p0: ['7H', '8S'], p1: ['9H', '9S'], p2: ['3D', '4C'] });
    const check = validatePlay(state, 'p1', ['9H']);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('not_your_turn');
  });

  it('refuse une carte que le joueur ne possède pas', () => {
    const state = playingGame({ p0: ['7H'], p1: ['9H'], p2: ['3D'] });
    const check = validatePlay(state, 'p0', ['14S']);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('not_owned');
  });

  it('impose la Dame de pique à l’ouverture de la toute première manche', () => {
    const base = playingGame({ p0: ['12S', '7H'], p1: ['9H'], p2: ['3D'] });
    const state = { ...base, mustOpenWithQueenOfSpades: true };
    const bad = validatePlay(state, 'p0', ['7H']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('must_open_with_queen');
    expect(validatePlay(state, 'p0', ['12S']).ok).toBe(true);
  });
});

describe('coups légaux', () => {
  it('n’expose que les combinaisons du bon effectif', () => {
    const hand = cards('9H', '9S', '13D', '13C', '15H');
    const combos = legalCombos(hand, { rank: 10, count: 2 }, { allowEqualRank: true });
    expect(combos.every((c) => c.count === 2)).toBe(true);
    expect(combos.map((c) => c.rank)).toEqual([13]);
  });

  it('propose tous les effectifs sur main libre', () => {
    const hand = cards('5H', '5S', '5D', '7C');
    const combos = legalCombos(hand, null, { allowEqualRank: true });
    expect(combos.filter((c) => c.rank === 5).map((c) => c.count).sort()).toEqual([1, 2, 3]);
  });
});
