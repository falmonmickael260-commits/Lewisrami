/**
 * Combinaisons du Rami : tierces, brelans, carrés, et tout ce qui touche aux jokers.
 *
 * Ce module ne connaît ni l'état de la partie ni les joueurs : il ne répond qu'à
 * la question « cette combinaison de cartes est-elle licite, et combien vaut-elle ? ».
 * C'est ce qui le rend entièrement testable.
 *
 * Règles encodées ici :
 * - une tierce est une suite de 3 cartes ou plus, de même enseigne ;
 * - un brelan est 3 cartes de même valeur, d'enseignes **différentes** ;
 * - un carré est le brelan complet à quatre enseignes ;
 * - une combinaison ne contient **jamais plus d'un joker** ;
 * - un joker posé représente une carte précise, et c'est cette carte qui donne
 *   sa valeur en points ;
 * - une combinaison posée ne peut plus être réorganisée : on ne peut que la
 *   **compléter** à ses extrémités, ou y remplacer le joker.
 */

import {
  SUITS,
  describeTarget,
  pointsAtRunValue,
  pointsInSet,
  rankAtRunValue,
  runValuesOf,
  shortLabel,
} from './cards';
import type {
  CardId,
  JokerRole,
  Meld,
  MeldKind,
  MeldProposal,
  MeldSlot,
  RamiCard,
  RamiRank,
  RunValue,
  Suit,
} from './types';

/** Un joker au maximum par combinaison (règle 18). */
export const MAX_JOKERS_PER_MELD = 1;
/** Trois cartes minimum, tierce comme brelan. */
export const MIN_MELD_SIZE = 3;
/** Une suite se joue entre l'As bas (1) et l'As haut (14). */
export const MIN_RUN_VALUE = 1;
export const MAX_RUN_VALUE = 14;

export type MeldRejection =
  | 'too_short'
  | 'too_many_jokers'
  | 'mixed_suits'
  | 'duplicate_card'
  | 'not_consecutive'
  | 'run_too_long'
  | 'mixed_ranks'
  | 'duplicate_suit'
  | 'set_too_large'
  | 'joker_placement'
  | 'not_a_meld';

export interface MeldFailure {
  ok: false;
  reason: MeldRejection;
  message: string;
}

export interface BuiltMeld {
  ok: true;
  kind: MeldKind;
  suit: Suit | null;
  rank: RamiRank | null;
  slots: MeldSlot[];
  points: number;
}

export type MeldResult = BuiltMeld | MeldFailure;

const MESSAGES: Record<MeldRejection, string> = {
  too_short: `Une combinaison compte au moins ${MIN_MELD_SIZE} cartes.`,
  too_many_jokers: 'Une combinaison ne peut contenir qu’un seul joker.',
  mixed_suits: 'Une tierce doit être composée de cartes du même signe.',
  duplicate_card: 'Cette carte est présente deux fois dans la combinaison.',
  not_consecutive: 'Une tierce doit être composée de cartes consécutives.',
  run_too_long: 'Une tierce ne peut pas dépasser l’As.',
  mixed_ranks: 'Un brelan doit être composé de cartes de même valeur.',
  duplicate_suit: 'Un brelan exige des signes différents.',
  set_too_large: 'Un carré compte au plus quatre cartes, une par signe.',
  joker_placement: 'La place du joker dans cette tierce est impossible.',
  not_a_meld: 'Cette sélection ne forme ni une tierce ni un brelan.',
};

function fail(reason: MeldRejection, message?: string): MeldFailure {
  return { ok: false, reason, message: message ?? MESSAGES[reason] };
}

/* ------------------------------------------------------------------ */
/* Lecture d'une combinaison posée                                     */
/* ------------------------------------------------------------------ */

export function jokerSlots(meld: Meld): MeldSlot[] {
  return meld.slots.filter((slot) => slot.card.joker);
}

export function jokerCountOf(meld: Meld): number {
  return jokerSlots(meld).length;
}

export function realSlots(meld: Meld): MeldSlot[] {
  return meld.slots.filter((slot) => !slot.card.joker);
}

/** Bornes d'une tierce posée, en positions de suite. */
export function runRange(meld: Meld): { min: RunValue; max: RunValue } | null {
  if (meld.kind !== 'run') return null;
  const values = meld.slots
    .map((slot) => (slot.card.joker ? slot.jokerRole?.runValue ?? null : slot.runValue ?? null))
    .filter((value): value is RunValue => value !== null);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Points d'une combinaison posée, joker compté à la valeur de la carte représentée. */
export function meldPoints(meld: Meld): number {
  if (meld.kind === 'set') {
    const rank = meld.rank as RamiRank;
    return meld.slots.length * pointsInSet(rank);
  }
  return meld.slots.reduce((sum, slot) => {
    const value = slot.card.joker ? slot.jokerRole?.runValue ?? null : slot.runValue ?? null;
    return sum + (value === null ? 0 : pointsAtRunValue(value));
  }, 0);
}

/**
 * Cette tierce peut-elle servir de **tierce obligatoire** pour une ouverture ?
 *
 * Le cahier des charges est explicite : « il faut 3 vraies cartes », et « un
 * joker ne peut pas remplacer une des trois cartes nécessaires ». Une tierce
 * de trois cartes doit donc être entièrement réelle ; une tierce de quatre
 * cartes dont une est un joker comporte bien trois vraies cartes et convient.
 */
export function qualifiesAsOpeningRun(meld: Meld): boolean {
  return meld.kind === 'run' && realSlots(meld).length >= MIN_MELD_SIZE;
}

/** Enseignes réellement présentes dans un brelan. */
export function setSuits(meld: Meld): Suit[] {
  return realSlots(meld).map((slot) => slot.card.suit as Suit);
}

/** Enseignes qu'il reste à apporter pour compléter un brelan en carré. */
export function missingSetSuits(meld: Meld): Suit[] {
  const present = new Set(setSuits(meld));
  return SUITS.filter((suit) => !present.has(suit));
}

/* ------------------------------------------------------------------ */
/* Construction d'une tierce                                           */
/* ------------------------------------------------------------------ */

interface Placement {
  values: number[];
  jokerValue: number | null;
}

/**
 * Cherche une disposition valide pour une suite.
 *
 * Les As ont deux positions possibles (1 ou 14) : on énumère les combinaisons,
 * ce qui reste trivial puisqu'une main ne contient que quelques As.
 * Le joker, s'il y en a un, bouche soit un trou intérieur, soit une extrémité —
 * auquel cas c'est l'ordre choisi par le joueur qui tranche.
 */
function placeRun(
  pips: RamiCard[],
  hasJoker: boolean,
  hint: { rank?: RamiRank; suit?: Suit } | null,
  jokerFirst: boolean,
): Placement | MeldFailure {
  const length = pips.length + (hasJoker ? 1 : 0);
  const options = pips.map((card) => runValuesOf(card.rank as RamiRank));

  const candidates: number[][] = [[]];
  for (const choices of options) {
    const next: number[][] = [];
    for (const partial of candidates) {
      for (const value of choices) next.push([...partial, value]);
    }
    candidates.length = 0;
    candidates.push(...next);
  }

  let lastFailure: MeldFailure = fail('not_consecutive');

  for (const assignment of candidates) {
    const sorted = assignment.slice().sort((a, b) => a - b);
    if (sorted.some((value, index) => index > 0 && value === sorted[index - 1])) {
      lastFailure = fail('duplicate_card', 'Une tierce ne peut pas contenir deux fois la même carte.');
      continue;
    }

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const span = max - min + 1;

    if (!hasJoker) {
      if (span !== length) {
        lastFailure = fail('not_consecutive');
        continue;
      }
      return { values: assignment, jokerValue: null };
    }

    // Un joker et un trou intérieur unique : le joker n'a qu'une place possible.
    if (span === length) {
      const present = new Set(sorted);
      const missing: number[] = [];
      for (let value = min; value <= max; value++) {
        if (!present.has(value)) missing.push(value);
      }
      if (missing.length !== 1) {
        lastFailure = fail('joker_placement');
        continue;
      }
      return { values: assignment, jokerValue: missing[0] };
    }

    // Les cartes réelles sont déjà consécutives : le joker prolonge une extrémité.
    if (span === length - 1) {
      const low = min - 1;
      const high = max + 1;
      const hinted =
        hint?.rank !== undefined
          ? runValuesOf(hint.rank).find((value) => value === low || value === high) ?? null
          : null;
      const chosen =
        hinted ??
        (jokerFirst
          ? low >= MIN_RUN_VALUE
            ? low
            : high
          : high <= MAX_RUN_VALUE
            ? high
            : low);
      if (chosen < MIN_RUN_VALUE || chosen > MAX_RUN_VALUE) {
        lastFailure = fail('run_too_long');
        continue;
      }
      return { values: assignment, jokerValue: chosen };
    }

    lastFailure = span > length ? fail('not_consecutive') : fail('joker_placement');
  }

  return lastFailure;
}

/* ------------------------------------------------------------------ */
/* Construction d'une combinaison à partir d'une sélection             */
/* ------------------------------------------------------------------ */

function slotFor(card: RamiCard, byId: string, runValue: RunValue | null): MeldSlot {
  return { card, jokerRole: null, byId, runValue };
}

function jokerSlot(card: RamiCard, byId: string, role: JokerRole): MeldSlot {
  return { card, jokerRole: role, byId, runValue: role.runValue };
}

/** Construit une tierce à partir d'une sélection ordonnée. */
export function buildRun(
  cards: readonly RamiCard[],
  byId: string,
  hint?: { rank?: RamiRank; suit?: Suit },
): MeldResult {
  if (cards.length < MIN_MELD_SIZE) return fail('too_short');

  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) return fail('duplicate_card');

  const jokers = cards.filter((card) => card.joker);
  if (jokers.length > MAX_JOKERS_PER_MELD) return fail('too_many_jokers');

  const pips = cards.filter((card) => !card.joker);
  if (pips.length === 0) return fail('not_a_meld');

  const suit = pips[0].suit as Suit;
  if (pips.some((card) => card.suit !== suit)) return fail('mixed_suits');

  const jokerIndex = cards.findIndex((card) => card.joker);
  const firstPipIndex = cards.findIndex((card) => !card.joker);
  const jokerFirst = jokerIndex !== -1 && jokerIndex < firstPipIndex;

  const placed = placeRun(pips, jokers.length === 1, hint ?? null, jokerFirst);
  if ('ok' in placed) return placed;

  const entries: { card: RamiCard; value: RunValue }[] = pips.map((card, index) => ({
    card,
    value: placed.values[index],
  }));

  if (placed.jokerValue !== null) {
    entries.push({ card: jokers[0], value: placed.jokerValue });
  }
  entries.sort((a, b) => a.value - b.value);

  const slots: MeldSlot[] = entries.map((entry) => {
    if (!entry.card.joker) return slotFor(entry.card, byId, entry.value);
    const rank = rankAtRunValue(entry.value) as RamiRank;
    return jokerSlot(entry.card, byId, { rank, suit, runValue: entry.value });
  });

  const points = slots.reduce(
    (sum, slot) => sum + pointsAtRunValue(slot.runValue as RunValue),
    0,
  );

  return { ok: true, kind: 'run', suit, rank: null, slots, points };
}

/** Construit un brelan ou un carré à partir d'une sélection. */
export function buildSet(cards: readonly RamiCard[], byId: string): MeldResult {
  if (cards.length < MIN_MELD_SIZE) return fail('too_short');
  if (cards.length > SUITS.length) return fail('set_too_large');

  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) return fail('duplicate_card');

  const jokers = cards.filter((card) => card.joker);
  if (jokers.length > MAX_JOKERS_PER_MELD) return fail('too_many_jokers');

  const pips = cards.filter((card) => !card.joker);
  if (pips.length < 2) return fail('not_a_meld');

  const rank = pips[0].rank as RamiRank;
  if (pips.some((card) => card.rank !== rank)) return fail('mixed_ranks');

  const suits = new Set(pips.map((card) => card.suit));
  if (suits.size !== pips.length) return fail('duplicate_suit');

  const slots: MeldSlot[] = pips.map((card) => slotFor(card, byId, null));
  if (jokers.length === 1) {
    // Dans un brelan, le joker ne fixe que la valeur : les enseignes restantes
    // demeurent ouvertes, et il faudra **toutes** les apporter pour le récupérer.
    slots.push(jokerSlot(jokers[0], byId, { rank, suit: null, runValue: null }));
  }

  const points = slots.length * pointsInSet(rank);
  return { ok: true, kind: 'set', suit: null, rank, slots, points };
}

/**
 * Construit la combinaison décrite par une proposition client.
 * Quand le genre n'est pas imposé, on tente la tierce puis le brelan.
 */
export function buildMeld(
  proposal: Pick<MeldProposal, 'kind' | 'jokerRank' | 'jokerSuit'>,
  cards: readonly RamiCard[],
  byId: string,
): MeldResult {
  const hint =
    proposal.jokerRank !== undefined
      ? { rank: proposal.jokerRank, suit: proposal.jokerSuit }
      : undefined;

  if (proposal.kind === 'run') return buildRun(cards, byId, hint);
  if (proposal.kind === 'set') return buildSet(cards, byId);

  const asRun = buildRun(cards, byId, hint);
  if (asRun.ok) return asRun;
  const asSet = buildSet(cards, byId);
  return asSet.ok ? asSet : asRun;
}

/** Devine le genre le plus probable d'une sélection, pour l'aide de l'interface. */
export function guessKind(cards: readonly RamiCard[], byId = 'preview'): MeldResult {
  const asRun = buildRun(cards, byId);
  if (asRun.ok) return asRun;
  const asSet = buildSet(cards, byId);
  if (asSet.ok) return asSet;
  // On renvoie l'échec le plus parlant : celui du genre que la sélection visait.
  const pips = cards.filter((card) => !card.joker);
  const sameRank = pips.length > 1 && pips.every((card) => card.rank === pips[0].rank);
  return sameRank ? asSet : asRun;
}

export interface AdjacentGroup {
  cardIds: CardId[];
  kind: 'run' | 'set';
  size: number;
}

/**
 * Combinaisons parmi des cartes déjà **côte à côte**, dans l'ordre donné.
 *
 * Volontairement différent de `guessKind` seul : ceci balaie une main entière
 * de gauche à droite et ne retient que des fenêtres de cartes consécutives —
 * jamais deux cartes qui ne se touchent pas. Sert à faire ressortir les
 * combinaisons qu'un tri (par signe, par valeur) ou un rangement manuel vient
 * de rapprocher, sans jamais chercher à travers toute la main.
 *
 * Une carte déjà retenue par un groupe n'est jamais réutilisée dans un autre ;
 * à chaque position, un carré (4) est préféré à une tierce/un brelan (3).
 */
export function detectAdjacentGroups(
  cards: readonly RamiCard[],
  excluded: ReadonlySet<CardId>,
  byId = 'preview',
): AdjacentGroup[] {
  const groups: AdjacentGroup[] = [];
  const claimed = new Set<CardId>();
  let i = 0;
  while (i < cards.length) {
    const card = cards[i];
    if (excluded.has(card.id) || claimed.has(card.id)) {
      i += 1;
      continue;
    }
    let matched: AdjacentGroup | null = null;
    for (const size of [4, 3]) {
      const window = cards.slice(i, i + size);
      if (window.length !== size) continue;
      if (window.some((c) => excluded.has(c.id) || claimed.has(c.id))) continue;
      const result = guessKind(window, byId);
      if (result.ok) {
        matched = { cardIds: window.map((c) => c.id), kind: result.kind, size };
        break;
      }
    }
    if (matched) {
      for (const id of matched.cardIds) claimed.add(id);
      groups.push(matched);
      i += matched.size;
    } else {
      i += 1;
    }
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Compléter une combinaison posée                                     */
/* ------------------------------------------------------------------ */

export type ExtendRejection =
  | 'unknown_meld'
  | 'empty'
  | 'too_many_jokers'
  | 'wrong_suit'
  | 'wrong_rank'
  | 'not_consecutive'
  | 'run_too_long'
  | 'duplicate_suit'
  | 'set_full';

export interface ExtendFailure {
  ok: false;
  reason: ExtendRejection;
  message: string;
}

export interface ExtendSuccess {
  ok: true;
  slots: MeldSlot[];
  /** Points ajoutés par le complément. */
  addedPoints: number;
}

export type ExtendResult = ExtendSuccess | ExtendFailure;

function extendFail(reason: ExtendRejection, message: string): ExtendFailure {
  return { ok: false, reason, message };
}

/**
 * Complète une tierce par ses extrémités.
 *
 * On n'insère jamais rien au milieu et on ne déplace aucune carte déjà posée :
 * la combinaison ne fait que s'allonger (règle 6).
 */
function extendRun(meld: Meld, cards: readonly RamiCard[]): ExtendResult {
  const range = runRange(meld);
  if (!range) return extendFail('unknown_meld', 'Cette tierce est illisible.');

  const suit = meld.suit as Suit;
  const jokers = cards.filter((card) => card.joker);
  if (jokerCountOf(meld) + jokers.length > MAX_JOKERS_PER_MELD) {
    return extendFail('too_many_jokers', MESSAGES.too_many_jokers);
  }

  const pips = cards.filter((card) => !card.joker);
  if (pips.some((card) => card.suit !== suit)) {
    return extendFail(
      'wrong_suit',
      `Cette tierce ne se complète qu'avec des cartes de ${describeSuit(suit)}.`,
    );
  }

  const total = cards.length;

  // On essaie chaque répartition « a cartes vers le bas, b vers le haut ».
  for (let below = 0; below <= total; below++) {
    const above = total - below;
    const newMin = range.min - below;
    const newMax = range.max + above;
    if (newMin < MIN_RUN_VALUE || newMax > MAX_RUN_VALUE) continue;

    const needed: number[] = [];
    for (let value = newMin; value < range.min; value++) needed.push(value);
    for (let value = range.max + 1; value <= newMax; value++) needed.push(value);

    const assignment = matchCardsToValues(cards, needed);
    if (!assignment) continue;

    const slots = meld.slots.slice();
    for (const { card, value } of assignment) {
      if (card.joker) {
        const rank = rankAtRunValue(value) as RamiRank;
        slots.push(jokerSlot(card, '', { rank, suit, runValue: value }));
      } else {
        slots.push(slotFor(card, '', value));
      }
    }
    slots.sort((a, b) => (a.runValue ?? 0) - (b.runValue ?? 0));

    const addedPoints = assignment.reduce(
      (sum, entry) => sum + pointsAtRunValue(entry.value),
      0,
    );
    return { ok: true, slots, addedPoints };
  }

  const wouldOverflow = total > MAX_RUN_VALUE - (range.max - range.min + 1);
  return wouldOverflow
    ? extendFail('run_too_long', MESSAGES.run_too_long)
    : extendFail(
        'not_consecutive',
        'Ces cartes ne prolongent pas la tierce : il faut suivre la suite sans trou.',
      );
}

function describeSuit(suit: Suit): string {
  return { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' }[suit];
}

/**
 * Associe chaque carte à une position à couvrir.
 *
 * Les cartes ordinaires n'ont qu'une position possible, l'As en a deux et le
 * joker les accepte toutes : un placement glouton, du plus contraint au moins
 * contraint, suffit et reste exact.
 */
function matchCardsToValues(
  cards: readonly RamiCard[],
  values: readonly number[],
): { card: RamiCard; value: number }[] | null {
  if (cards.length !== values.length) return null;
  const remaining = values.slice();
  const result: { card: RamiCard; value: number }[] = [];

  const byConstraint = cards
    .slice()
    .sort((a, b) => optionCount(a) - optionCount(b));

  for (const card of byConstraint) {
    if (card.joker) {
      result.push({ card, value: remaining[0] });
      remaining.shift();
      continue;
    }
    const options = runValuesOf(card.rank as RamiRank);
    const index = remaining.findIndex((value) => options.includes(value));
    if (index === -1) return null;
    result.push({ card, value: remaining[index] });
    remaining.splice(index, 1);
  }

  return remaining.length === 0 ? result : null;
}

function optionCount(card: RamiCard): number {
  if (card.joker) return 99;
  return runValuesOf(card.rank as RamiRank).length;
}

/** Complète un brelan : une carte par enseigne manquante, quatre au maximum. */
function extendSet(meld: Meld, cards: readonly RamiCard[]): ExtendResult {
  const rank = meld.rank as RamiRank;
  if (meld.slots.length + cards.length > SUITS.length) {
    return extendFail('set_full', MESSAGES.set_too_large);
  }

  const jokers = cards.filter((card) => card.joker);
  if (jokerCountOf(meld) + jokers.length > MAX_JOKERS_PER_MELD) {
    return extendFail('too_many_jokers', MESSAGES.too_many_jokers);
  }

  const pips = cards.filter((card) => !card.joker);
  if (pips.some((card) => card.rank !== rank)) {
    return extendFail(
      'wrong_rank',
      `Ce brelan ne se complète qu'avec des ${describeTarget(rank, null)}.`,
    );
  }

  const present = new Set(setSuits(meld));
  for (const card of pips) {
    const suit = card.suit as Suit;
    if (present.has(suit)) {
      return extendFail('duplicate_suit', MESSAGES.duplicate_suit);
    }
    present.add(suit);
  }

  const slots = meld.slots.slice();
  for (const card of pips) slots.push(slotFor(card, '', null));
  for (const card of jokers) {
    slots.push(jokerSlot(card, '', { rank, suit: null, runValue: null }));
  }

  return { ok: true, slots, addedPoints: cards.length * pointsInSet(rank) };
}

export function extendMeldWith(meld: Meld, cards: readonly RamiCard[]): ExtendResult {
  if (cards.length === 0) {
    return extendFail('empty', 'Sélectionnez au moins une carte à ajouter.');
  }
  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) {
    return extendFail('duplicate_suit', MESSAGES.duplicate_card);
  }
  return meld.kind === 'run' ? extendRun(meld, cards) : extendSet(meld, cards);
}

/* ------------------------------------------------------------------ */
/* Récupération d'un joker                                             */
/* ------------------------------------------------------------------ */

export type ReclaimRejection =
  | 'no_joker'
  | 'wrong_card'
  | 'missing_cards'
  | 'too_many_cards';

export interface ReclaimFailure {
  ok: false;
  reason: ReclaimRejection;
  message: string;
}

export interface ReclaimSuccess {
  ok: true;
  /** Le joker libéré : il rejoint la main du joueur. */
  joker: RamiCard;
  slots: MeldSlot[];
}

export type ReclaimResult = ReclaimSuccess | ReclaimFailure;

function reclaimFail(reason: ReclaimRejection, message: string): ReclaimFailure {
  return { ok: false, reason, message };
}

/**
 * Cartes exigées pour récupérer le joker d'une combinaison.
 *
 * - Tierce : **la** carte représentée, exactement (♥7 pour `♥5 ♥6 JOKER ♥8`).
 *   Un 7 d'un autre signe ne convient pas.
 * - Brelan : **toutes** les enseignes manquantes. Avec une seule carte, c'est
 *   interdit.
 */
export function jokerRequirement(
  meld: Meld,
): { rank: RamiRank; suits: Suit[] } | null {
  const slot = jokerSlots(meld)[0];
  if (!slot || !slot.jokerRole) return null;
  const { rank, suit } = slot.jokerRole;
  if (meld.kind === 'run') return { rank, suits: suit ? [suit] : [] };
  return { rank, suits: missingSetSuits(meld) };
}

/** Phrase d'explication affichée au joueur. */
export function describeJokerRequirement(meld: Meld): string | null {
  const requirement = jokerRequirement(meld);
  if (!requirement) return null;
  if (meld.kind === 'run') {
    return `Il faut le ${describeTarget(requirement.rank, requirement.suits[0] ?? null)} exactement.`;
  }
  const list = requirement.suits.map((suit) => describeSuit(suit)).join(' et ');
  return requirement.suits.length > 1
    ? `Il faut les deux cartes manquantes : ${describeTarget(requirement.rank, null)} de ${list}.`
    : `Il faut le ${describeTarget(requirement.rank, requirement.suits[0] ?? null)}.`;
}

export function reclaimJokerWith(meld: Meld, cards: readonly RamiCard[]): ReclaimResult {
  const slot = jokerSlots(meld)[0];
  if (!slot || !slot.jokerRole) {
    return reclaimFail('no_joker', 'Cette combinaison ne contient pas de joker.');
  }

  const requirement = jokerRequirement(meld);
  if (!requirement) {
    return reclaimFail('no_joker', 'Cette combinaison ne contient pas de joker.');
  }

  if (cards.some((card) => card.joker)) {
    return reclaimFail('wrong_card', 'Un joker ne peut pas remplacer un joker.');
  }
  if (cards.some((card) => card.rank !== requirement.rank)) {
    return reclaimFail(
      'wrong_card',
      `Il faut ${describeTarget(requirement.rank, null)} pour remplacer ce joker.`,
    );
  }
  if (cards.length > requirement.suits.length) {
    return reclaimFail('too_many_cards', 'Trop de cartes pour ce remplacement.');
  }
  if (cards.length < requirement.suits.length) {
    return reclaimFail(
      'missing_cards',
      describeJokerRequirement(meld) ??
        'Vous devez avoir toutes les cartes manquantes pour récupérer ce joker.',
    );
  }

  const needed = new Set(requirement.suits);
  for (const card of cards) {
    const suit = card.suit as Suit;
    if (!needed.has(suit)) {
      return reclaimFail(
        'wrong_card',
        `Le ${shortLabel(card)} ne convient pas : ${describeJokerRequirement(meld)}`,
      );
    }
    needed.delete(suit);
  }

  const slots = meld.slots.filter((entry) => entry.card.id !== slot.card.id);
  if (meld.kind === 'run') {
    slots.push(slotFor(cards[0], slot.byId, slot.jokerRole.runValue ?? null));
    slots.sort((a, b) => (a.runValue ?? 0) - (b.runValue ?? 0));
  } else {
    for (const card of cards) slots.push(slotFor(card, slot.byId, null));
  }

  return { ok: true, joker: slot.card, slots };
}

/* ------------------------------------------------------------------ */
/* Libellés                                                           */
/* ------------------------------------------------------------------ */

/** « une tierce à ♥ de 5 à 8 », « un carré de 7 » — affiché dans les annonces. */
export function meldLabel(meld: Pick<Meld, 'kind' | 'slots' | 'rank' | 'suit'>): string {
  if (meld.kind === 'set') {
    const name = describeTarget(meld.rank as RamiRank, null);
    return meld.slots.length >= 4 ? `carré de ${name}` : `brelan de ${name}`;
  }
  const values = meld.slots
    .map((slot) => slot.runValue)
    .filter((value): value is RunValue => value !== null && value !== undefined);
  if (values.length === 0) return 'tierce';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const label = (value: RunValue) => {
    const rank = rankAtRunValue(value);
    return rank === null ? '?' : describeTarget(rank, null);
  };
  return `tierce à ${describeSuit(meld.suit as Suit)}, du ${label(min)} au ${label(max)}`;
}

export function cardIdsOf(meld: Meld): CardId[] {
  return meld.slots.map((slot) => slot.card.id);
}
