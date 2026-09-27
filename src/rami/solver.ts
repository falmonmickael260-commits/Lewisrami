/**
 * Recherche de combinaisons dans une main.
 *
 * Deux usages, un seul algorithme :
 * - les **bots** s'en servent pour jouer ;
 * - l'**interface** s'en sert pour proposer au joueur « Ouvrir (71 pts) » ou
 *   signaler qu'un complément est possible, sans jamais décider à sa place.
 *
 * Le solveur énumère d'abord toutes les combinaisons réalisables, puis cherche
 * la meilleure famille de combinaisons **disjointes**. L'exploration est bornée
 * par un budget de nœuds : une main de Rami est petite, mais on ne laisse jamais
 * un calcul s'emballer sur le serveur.
 */

import { SUITS, pointsInSet, rankAtRunValue, runValuesOf } from './cards';
import {
  buildRun,
  buildSet,
  extendMeldWith,
  jokerRequirement,
  reclaimJokerWith,
} from './melds';
import type {
  CardId,
  Meld,
  MeldKind,
  MeldProposal,
  RamiCard,
  RamiRank,
  Suit,
} from './types';

/** Plafond d'exploration : largement au-delà de ce qu'une main réelle demande. */
const NODE_BUDGET = 120_000;

export interface Candidate {
  kind: MeldKind;
  cardIds: CardId[];
  points: number;
  /** Tierce de trois vraies cartes : convient comme tierce obligatoire. */
  qualifiesRun: boolean;
  jokerRank?: RamiRank;
  jokerSuit?: Suit;
}

export interface LayDown {
  melds: MeldProposal[];
  points: number;
  cardIds: CardId[];
  /** Au moins une tierce de trois vraies cartes est présente. */
  hasQualifyingRun: boolean;
}

/* ------------------------------------------------------------------ */
/* Énumération                                                         */
/* ------------------------------------------------------------------ */

function jokersOf(hand: readonly RamiCard[]): RamiCard[] {
  return hand.filter((card) => card.joker);
}

/**
 * Toutes les tierces réalisables d'une enseigne.
 *
 * On balaie chaque fenêtre `[début, fin]` de la suite : si toutes les cartes y
 * sont, c'est une tierce ; s'il manque exactement une carte et qu'un joker est
 * disponible, c'en est une aussi.
 */
function runCandidates(hand: readonly RamiCard[], joker: RamiCard | null): Candidate[] {
  const out: Candidate[] = [];

  for (const suit of SUITS) {
    const byValue = new Map<number, CardId[]>();
    for (const card of hand) {
      if (card.joker || card.suit !== suit) continue;
      for (const value of runValuesOf(card.rank as RamiRank)) {
        const list = byValue.get(value);
        if (list) list.push(card.id);
        else byValue.set(value, [card.id]);
      }
    }
    if (byValue.size === 0) continue;

    for (let start = 1; start <= 12; start++) {
      for (let end = start + 2; end <= 14; end++) {
        const used = new Set<CardId>();
        const picked: CardId[] = [];
        const missing: number[] = [];

        for (let value = start; value <= end; value++) {
          const available = byValue.get(value) ?? [];
          const pick = available.find((id) => !used.has(id));
          if (pick) {
            used.add(pick);
            picked.push(pick);
          } else {
            missing.push(value);
          }
        }

        if (missing.length === 0) {
          const cards = picked.map((id) => hand.find((card) => card.id === id) as RamiCard);
          const built = buildRun(cards, 'solver');
          if (built.ok) {
            out.push({
              kind: 'run',
              cardIds: picked,
              points: built.points,
              qualifiesRun: true,
            });
          }
          continue;
        }

        if (missing.length === 1 && joker) {
          const rank = rankAtRunValue(missing[0]);
          if (rank === null) continue;
          const cards = [
            ...picked.map((id) => hand.find((card) => card.id === id) as RamiCard),
            joker,
          ];
          const built = buildRun(cards, 'solver', { rank, suit });
          if (built.ok) {
            out.push({
              kind: 'run',
              cardIds: [...picked, joker.id],
              points: built.points,
              // Trois vraies cartes suffisent : le joker n'est alors pas l'une des trois.
              qualifiesRun: picked.length >= 3,
              jokerRank: rank,
              jokerSuit: suit,
            });
          }
        }
      }
    }
  }

  return out;
}

/** Sous-ensembles d'une liste, d'une taille donnée. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (size > items.length) return [];
  const out: T[][] = [];
  const walk = (start: number, current: T[]) => {
    if (current.length === size) {
      out.push(current.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      walk(i + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return out;
}

/** Tous les brelans et carrés réalisables. */
function setCandidates(hand: readonly RamiCard[], joker: RamiCard | null): Candidate[] {
  const out: Candidate[] = [];

  for (let rank = 1 as RamiRank; rank <= 13; rank = (rank + 1) as RamiRank) {
    // Un seul exemplaire par enseigne : un brelan exige des signes différents.
    const bySuit = new Map<Suit, CardId>();
    for (const card of hand) {
      if (card.joker || card.rank !== rank) continue;
      const suit = card.suit as Suit;
      if (!bySuit.has(suit)) bySuit.set(suit, card.id);
    }
    const entries = Array.from(bySuit.values());
    if (entries.length < 2) continue;

    const unit = pointsInSet(rank);

    for (let size = 3; size <= Math.min(4, entries.length); size++) {
      for (const subset of combinations(entries, size)) {
        out.push({ kind: 'set', cardIds: subset, points: size * unit, qualifiesRun: false });
      }
    }

    if (joker) {
      for (let size = 2; size <= Math.min(3, entries.length); size++) {
        for (const subset of combinations(entries, size)) {
          out.push({
            kind: 'set',
            cardIds: [...subset, joker.id],
            points: (size + 1) * unit,
            qualifiesRun: false,
          });
        }
      }
    }
  }

  return out;
}

/**
 * Toutes les combinaisons réalisables avec cette main.
 *
 * Le joker est traité comme une ressource unique : si la main en contient
 * plusieurs, on ne propose que le premier dans chaque combinaison — la règle
 * interdit de toute façon d'en poser deux au même endroit, et le second
 * réapparaît naturellement dans une autre combinaison de la même recherche.
 */
export function enumerateCandidates(hand: readonly RamiCard[]): Candidate[] {
  const jokers = jokersOf(hand);
  const seen = new Set<string>();
  const out: Candidate[] = [];

  // Une passe par joker disponible, plus une passe sans joker.
  const passes: (RamiCard | null)[] = jokers.length > 0 ? [...jokers, null] : [null];
  for (const joker of passes) {
    for (const candidate of [...runCandidates(hand, joker), ...setCandidates(hand, joker)]) {
      const key = `${candidate.kind}:${candidate.cardIds.slice().sort().join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }

  return out.sort((a, b) => b.points - a.points);
}

/* ------------------------------------------------------------------ */
/* Recherche de la meilleure pose                                      */
/* ------------------------------------------------------------------ */

export interface LayDownOptions {
  /** Points minimum exigés (seuil d'ouverture). */
  minPoints?: number;
  /** Une tierce de trois vraies cartes est-elle obligatoire ? */
  requireRun?: boolean;
  /** Cartes à conserver en main : toujours au moins une, pour la défausse. */
  keepAtLeast?: number;
  /** Cette carte doit impérativement figurer dans la pose. */
  mustInclude?: CardId;
}

interface Node {
  points: number;
  chosen: Candidate[];
  used: Set<CardId>;
}

/**
 * Meilleure pose satisfaisant les contraintes, ou `null`.
 *
 * « Meilleure » signifie : le plus de points, puis le moins de cartes engagées.
 * Le solveur ne cherche pas à gagner la manche — il cherche une pose **légale et
 * rentable**, ce qui suffit à ouvrir et à faire jouer un bot crédible.
 */
export function findLayDown(
  hand: readonly RamiCard[],
  options: LayDownOptions = {},
): LayDown | null {
  const minPoints = options.minPoints ?? 0;
  const requireRun = options.requireRun ?? false;
  const keepAtLeast = Math.max(1, options.keepAtLeast ?? 1);
  const maxCards = hand.length - keepAtLeast;
  if (maxCards < 3) return null;

  const candidates = enumerateCandidates(hand).filter(
    (candidate) => candidate.cardIds.length <= maxCards,
  );
  if (candidates.length === 0) return null;

  let best: Node | null = null;
  let nodes = 0;

  const accept = (node: Node): boolean => {
    if (node.chosen.length === 0) return false;
    if (node.points < minPoints) return false;
    if (requireRun && !node.chosen.some((candidate) => candidate.qualifiesRun)) return false;
    if (options.mustInclude && !node.used.has(options.mustInclude)) return false;
    return true;
  };

  const better = (node: Node): boolean => {
    if (!best) return true;
    if (node.points !== best.points) return node.points > best.points;
    return node.used.size < best.used.size;
  };

  const walk = (index: number, node: Node) => {
    if (nodes++ > NODE_BUDGET) return;
    if (accept(node) && better(node)) {
      best = { points: node.points, chosen: node.chosen.slice(), used: new Set(node.used) };
    }
    if (node.used.size >= maxCards) return;

    for (let i = index; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (node.used.size + candidate.cardIds.length > maxCards) continue;
      if (candidate.cardIds.some((id) => node.used.has(id))) continue;

      for (const id of candidate.cardIds) node.used.add(id);
      node.chosen.push(candidate);
      node.points += candidate.points;

      walk(i + 1, node);

      node.points -= candidate.points;
      node.chosen.pop();
      for (const id of candidate.cardIds) node.used.delete(id);
    }
  };

  walk(0, { points: 0, chosen: [], used: new Set() });

  if (!best) return null;
  const solution = best as Node;

  return {
    melds: solution.chosen.map((candidate) => ({
      kind: candidate.kind,
      cardIds: candidate.cardIds,
      jokerRank: candidate.jokerRank,
      jokerSuit: candidate.jokerSuit,
    })),
    points: solution.points,
    cardIds: Array.from(solution.used),
    hasQualifyingRun: solution.chosen.some((candidate) => candidate.qualifiesRun),
  };
}

/* ------------------------------------------------------------------ */
/* Compléments et jokers sur la table                                  */
/* ------------------------------------------------------------------ */

export interface ExtensionOption {
  meldId: string;
  cardIds: CardId[];
  addedPoints: number;
  ownTeam: boolean;
}

/**
 * Tous les compléments possibles, combinaison par combinaison.
 *
 * On teste d'abord le complément le plus large — une tierce se prolonge souvent
 * de plusieurs cartes d'un coup — puis on réduit jusqu'à trouver ce qui passe.
 */
export function findExtensions(
  hand: readonly RamiCard[],
  melds: readonly Meld[],
  options: { teamId: number; allowOpponents: boolean; keepAtLeast?: number },
): ExtensionOption[] {
  const keepAtLeast = Math.max(1, options.keepAtLeast ?? 1);
  const budget = hand.length - keepAtLeast;
  if (budget < 1) return [];

  const out: ExtensionOption[] = [];

  for (const meld of melds) {
    const ownTeam = meld.teamId === options.teamId;
    if (!ownTeam && !options.allowOpponents) continue;

    const usable = hand.filter((card) => {
      if (card.joker) return true;
      if (meld.kind === 'set') return card.rank === meld.rank;
      return card.suit === meld.suit;
    });
    if (usable.length === 0) continue;

    const limit = Math.min(usable.length, budget, meld.kind === 'set' ? 2 : 6);

    for (let size = limit; size >= 1; size--) {
      let found: ExtensionOption | null = null;
      for (const subset of combinations(usable, size)) {
        const result = extendMeldWith(meld, subset);
        if (!result.ok) continue;
        found = {
          meldId: meld.id,
          cardIds: subset.map((card) => card.id),
          addedPoints: result.addedPoints,
          ownTeam,
        };
        break;
      }
      if (found) {
        out.push(found);
        break;
      }
    }
  }

  return out.sort((a, b) => b.addedPoints - a.addedPoints);
}

export interface ReclaimOption {
  meldId: string;
  cardIds: CardId[];
  ownTeam: boolean;
}

/** Jokers récupérables avec cette main, combinaison par combinaison. */
export function findReclaims(
  hand: readonly RamiCard[],
  melds: readonly Meld[],
  options: { teamId: number; allowOpponents: boolean; keepAtLeast?: number },
): ReclaimOption[] {
  const keepAtLeast = Math.max(1, options.keepAtLeast ?? 1);
  const out: ReclaimOption[] = [];

  for (const meld of melds) {
    const ownTeam = meld.teamId === options.teamId;
    if (!ownTeam && !options.allowOpponents) continue;

    const requirement = jokerRequirement(meld);
    if (!requirement || requirement.suits.length === 0) continue;

    // Le joker revient en main : le solde net est `cartes posées − 1`.
    if (hand.length - requirement.suits.length + 1 < keepAtLeast) continue;

    const picked: RamiCard[] = [];
    for (const suit of requirement.suits) {
      const card = hand.find(
        (entry) =>
          !entry.joker &&
          entry.rank === requirement.rank &&
          entry.suit === suit &&
          !picked.some((chosen) => chosen.id === entry.id),
      );
      if (!card) break;
      picked.push(card);
    }
    if (picked.length !== requirement.suits.length) continue;

    const result = reclaimJokerWith(meld, picked);
    if (!result.ok) continue;

    out.push({ meldId: meld.id, cardIds: picked.map((card) => card.id), ownTeam });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Évaluation d'une main                                               */
/* ------------------------------------------------------------------ */

/**
 * Cartes qui ne participent à aucune combinaison potentielle.
 * Sert à choisir une défausse et à jauger une main dans l'interface.
 */
export function orphanCards(hand: readonly RamiCard[]): RamiCard[] {
  const engaged = new Set<CardId>();
  for (const candidate of enumerateCandidates(hand)) {
    for (const id of candidate.cardIds) engaged.add(id);
  }
  return hand.filter((card) => !engaged.has(card.id));
}

/** Vérifie qu'un brelan ou une tierce est encore constructible sans joker. */
export function bestRealRun(hand: readonly RamiCard[]): Candidate | null {
  const runs = enumerateCandidates(hand).filter((candidate) => candidate.qualifiesRun);
  return runs.length > 0 ? runs[0] : null;
}

/** Vérifie qu'une carte peut entrer immédiatement dans quelque chose. */
export function cardIsUseful(
  hand: readonly RamiCard[],
  cardId: CardId,
  melds: readonly Meld[],
  options: { teamId: number; allowOpponents: boolean; canExtend: boolean },
): boolean {
  if (enumerateCandidates(hand).some((candidate) => candidate.cardIds.includes(cardId))) {
    return true;
  }
  if (!options.canExtend) return false;
  const card = hand.find((entry) => entry.id === cardId);
  if (!card) return false;
  return findExtensions(hand, melds, {
    teamId: options.teamId,
    allowOpponents: options.allowOpponents,
  }).some((option) => option.cardIds.includes(cardId));
}
