/**
 * Validation centrale des coups du Rami.
 *
 * Chaque fonction répond à une seule question — « ce joueur peut-il faire
 * cela, maintenant ? » — et renvoie un **message destiné au joueur** en cas de
 * refus, jamais un code technique (règle 41 du cahier des charges).
 *
 * Le serveur appelle systématiquement ces fonctions avant d'appliquer une
 * action, quoi que prétende le client.
 */

import { shortLabel } from './cards';
import {
  buildMeld,
  extendMeldWith,
  meldLabel,
  qualifiesAsOpeningRun,
  reclaimJokerWith,
  type BuiltMeld,
  type ExtendSuccess,
  type ReclaimSuccess,
} from './melds';
import { openingRequirementFor } from './scoring';
import type {
  CardId,
  Meld,
  MeldProposal,
  RamiCard,
  RamiPlayer,
  RamiState,
} from './types';

export interface MoveFailure {
  ok: false;
  message: string;
}

function refuse(message: string): MoveFailure {
  return { ok: false, message };
}

/* ------------------------------------------------------------------ */
/* Contexte commun                                                     */
/* ------------------------------------------------------------------ */

export function findPlayer(state: RamiState, playerId: string): RamiPlayer | undefined {
  return state.players.find((player) => player.id === playerId);
}

export function findMeld(state: RamiState, meldId: string): Meld | undefined {
  return state.melds.find((meld) => meld.id === meldId);
}

/** Vérifie qu'on est bien en jeu, au tour de ce joueur, à l'étape attendue. */
function requireTurn(
  state: RamiState,
  playerId: string,
  stage: 'draw' | 'meld',
): { ok: true; player: RamiPlayer } | MoveFailure {
  if (state.phase !== 'playing') return refuse("La partie n'est pas en cours.");
  const player = findPlayer(state, playerId);
  if (!player) return refuse('Vous ne faites plus partie de cette table.');
  if (state.currentPlayerId !== playerId) return refuse("Ce n'est pas votre tour.");
  const turn = state.turn;
  if (!turn) return refuse('Aucun tour en cours.');
  if (turn.stage !== stage) {
    return refuse(
      stage === 'draw'
        ? 'Vous avez déjà pioché ce tour-ci.'
        : 'Vous devez d’abord piocher ou reprendre la carte de la défausse.',
    );
  }
  return { ok: true, player };
}

/** Récupère les cartes de la main correspondant à une liste d'identifiants. */
function collect(
  player: RamiPlayer,
  cardIds: readonly CardId[],
): { ok: true; cards: RamiCard[] } | MoveFailure {
  if (cardIds.length === 0) return refuse('Sélectionnez au moins une carte.');
  const unique = new Set(cardIds);
  if (unique.size !== cardIds.length) {
    return refuse('La même carte est sélectionnée deux fois.');
  }
  const cards: RamiCard[] = [];
  for (const id of cardIds) {
    const card = player.hand.find((entry) => entry.id === id);
    if (!card) return refuse("Cette carte n'est pas dans votre main.");
    cards.push(card);
  }
  return { ok: true, cards };
}

/**
 * Il faut toujours conserver une carte à jeter (règle 12).
 * Poser toutes ses cartes d'un coup, sans défausse, est interdit.
 */
const KEEP_ONE = 'Vous devez conserver une carte à jeter pour finir la manche.';

/* ------------------------------------------------------------------ */
/* Pioche                                                              */
/* ------------------------------------------------------------------ */

export interface DrawStockOk {
  ok: true;
}

export function validateDrawStock(state: RamiState, playerId: string): DrawStockOk | MoveFailure {
  const turn = requireTurn(state, playerId, 'draw');
  if (!turn.ok) return turn;
  if (state.stock.length === 0 && state.discard.length <= 1) {
    return refuse('La pioche est épuisée et la défausse ne peut pas être recyclée.');
  }
  return { ok: true };
}

export interface TakeDiscardOk {
  ok: true;
  card: RamiCard;
}

/**
 * Reprendre la carte du dessus de la défausse.
 *
 * La reprise est autorisée librement, mais la carte **doit** avoir été intégrée
 * à une combinaison au moment de la défausse (règle 9). Tant qu'elle est encore
 * en main, le joueur peut la remettre en place avec `cancel_take` : la carte
 * retourne exactement là où elle était, sans rien révéler.
 */
export function validateTakeDiscard(
  state: RamiState,
  playerId: string,
): TakeDiscardOk | MoveFailure {
  const turn = requireTurn(state, playerId, 'draw');
  if (!turn.ok) return turn;
  const card = state.discard[state.discard.length - 1];
  if (!card) return refuse('La défausse est vide.');
  return { ok: true, card };
}

export function validateCancelTake(
  state: RamiState,
  playerId: string,
): { ok: true; card: RamiCard } | MoveFailure {
  if (state.phase !== 'playing') return refuse("La partie n'est pas en cours.");
  const player = findPlayer(state, playerId);
  if (!player) return refuse('Vous ne faites plus partie de cette table.');
  if (state.currentPlayerId !== playerId) return refuse("Ce n'est pas votre tour.");
  const turn = state.turn;
  if (!turn || turn.takenCardId === null) {
    return refuse("Vous n'avez pas reprise de carte à remettre.");
  }
  if (turn.takenCardUsed) {
    return refuse('Cette carte est déjà posée : impossible de revenir en arrière.');
  }
  const card = player.hand.find((entry) => entry.id === turn.takenCardId);
  if (!card) return refuse('Cette carte a déjà quitté votre main.');
  return { ok: true, card };
}

/* ------------------------------------------------------------------ */
/* Poser des combinaisons                                              */
/* ------------------------------------------------------------------ */

export interface LayMeldsOk {
  ok: true;
  built: BuiltMeld[];
  /** Points totaux de la pose : c'est ce score qui devient celui de l'ouverture. */
  points: number;
  /** Cette pose constitue l'ouverture de l'équipe. */
  isOpening: boolean;
  usedIds: CardId[];
}

/**
 * Poser une ou plusieurs combinaisons.
 *
 * Toutes les combinaisons d'une même action sont comptées **ensemble** : c'est
 * ainsi qu'on atteint les 71 points d'ouverture. Une tierce de trois vraies
 * cartes doit figurer dans le lot (règle 15), et le joker peut servir à
 * atteindre le seuil dans une autre combinaison (règle 24).
 */
export function validateLayMelds(
  state: RamiState,
  playerId: string,
  proposals: readonly MeldProposal[],
): LayMeldsOk | MoveFailure {
  const turn = requireTurn(state, playerId, 'meld');
  if (!turn.ok) return turn;
  const { player } = turn;

  if (proposals.length === 0) return refuse('Aucune combinaison à poser.');

  const seen = new Set<CardId>();
  const built: BuiltMeld[] = [];

  for (const proposal of proposals) {
    for (const id of proposal.cardIds) {
      if (seen.has(id)) {
        return refuse('Une même carte ne peut pas servir dans deux combinaisons.');
      }
      seen.add(id);
    }
    const collected = collect(player, proposal.cardIds);
    if (!collected.ok) return collected;

    const meld = buildMeld(proposal, collected.cards, playerId);
    if (!meld.ok) return refuse(meld.message);
    built.push(meld);
  }

  const usedIds = Array.from(seen);
  if (player.hand.length - usedIds.length < 1) return refuse(KEEP_ONE);

  const points = built.reduce((sum, meld) => sum + meld.points, 0);
  const requirement = openingRequirementFor(state, player);

  if (requirement) {
    const hasRun = built.some((meld) =>
      qualifiesAsOpeningRun({
        kind: meld.kind,
        slots: meld.slots,
      } as Meld),
    );
    if (requirement.requiresRun && !hasRun) {
      return refuse(
        requirement.teamAlreadyOpened
          ? 'Votre première pose doit contenir une tierce de trois vraies cartes.'
          : 'Votre ouverture doit contenir une tierce de trois vraies cartes (un joker ne compte pas).',
      );
    }
    if (points < requirement.points) {
      return refuse(
        `Il faut au minimum ${requirement.points} points pour ouvrir — cette pose en vaut ${points}.`,
      );
    }
  }

  return {
    ok: true,
    built,
    points,
    isOpening: Boolean(requirement && !requirement.teamAlreadyOpened),
    usedIds,
  };
}

/* ------------------------------------------------------------------ */
/* Compléter une combinaison posée                                     */
/* ------------------------------------------------------------------ */

/**
 * Droit d'intervenir sur une combinaison déjà sur la table.
 *
 * Il faut avoir posé soi-même au moins une combinaison dans la manche. Pour
 * toucher à la combinaison d'une **autre équipe**, toutes les équipes doivent
 * avoir ouvert (règles 23 et 28).
 */
function canTouch(state: RamiState, player: RamiPlayer, meld: Meld): MoveFailure | null {
  if (!player.hasEntered) {
    return refuse(
      'Vous devez d’abord poser votre première combinaison avant de compléter la table.',
    );
  }
  if (meld.teamId === player.teamId) return null;
  const allOpened = state.teams.every((team) => team.opening.opened);
  if (!allOpened) {
    return refuse(
      'Vous pourrez toucher aux combinaisons adverses lorsque toutes les équipes auront ouvert.',
    );
  }
  return null;
}

export interface ExtendOk extends ExtendSuccess {
  meld: Meld;
  cards: RamiCard[];
}

export function validateExtend(
  state: RamiState,
  playerId: string,
  meldId: string,
  cardIds: readonly CardId[],
): ExtendOk | MoveFailure {
  const turn = requireTurn(state, playerId, 'meld');
  if (!turn.ok) return turn;
  const { player } = turn;

  const meld = findMeld(state, meldId);
  if (!meld) return refuse('Cette combinaison n’est plus sur la table.');

  const gate = canTouch(state, player, meld);
  if (gate) return gate;

  const collected = collect(player, cardIds);
  if (!collected.ok) return collected;

  if (player.hand.length - collected.cards.length < 1) return refuse(KEEP_ONE);

  const result = extendMeldWith(meld, collected.cards);
  if (!result.ok) return refuse(result.message);

  return { ...result, meld, cards: collected.cards };
}

export interface ReclaimOk extends ReclaimSuccess {
  meld: Meld;
  cards: RamiCard[];
}

/**
 * Récupérer le joker d'une combinaison.
 *
 * Tierce : il faut la carte exacte que le joker représente. Brelan : il faut
 * **toutes** les enseignes manquantes (règles 21 et 22). Le joker récupéré peut
 * être rejoué tout de suite ou conservé en main.
 */
export function validateReclaim(
  state: RamiState,
  playerId: string,
  meldId: string,
  cardIds: readonly CardId[],
): ReclaimOk | MoveFailure {
  const turn = requireTurn(state, playerId, 'meld');
  if (!turn.ok) return turn;
  const { player } = turn;

  const meld = findMeld(state, meldId);
  if (!meld) return refuse('Cette combinaison n’est plus sur la table.');

  const gate = canTouch(state, player, meld);
  if (gate) return gate;

  const collected = collect(player, cardIds);
  if (!collected.ok) return collected;

  // Le joker rejoint la main : le solde net est `cartes posées − 1`.
  if (player.hand.length - collected.cards.length + 1 < 1) return refuse(KEEP_ONE);

  const result = reclaimJokerWith(meld, collected.cards);
  if (!result.ok) return refuse(result.message);

  return { ...result, meld, cards: collected.cards };
}

/* ------------------------------------------------------------------ */
/* Défausse                                                            */
/* ------------------------------------------------------------------ */

export interface DiscardOk {
  ok: true;
  card: RamiCard;
  /** La main devient vide : le joueur remporte la manche. */
  finishes: boolean;
}

/**
 * Jeter une carte clôt le tour, et c'est obligatoire (règle 11).
 *
 * Deux refus possibles :
 * - la carte reprise dans la défausse n'a pas été utilisée (règle 9) ;
 * - la carte n'est pas en main.
 */
export function validateDiscard(
  state: RamiState,
  playerId: string,
  cardId: CardId,
): DiscardOk | MoveFailure {
  const turn = requireTurn(state, playerId, 'meld');
  if (!turn.ok) return turn;
  const { player } = turn;
  const current = state.turn;

  const card = player.hand.find((entry) => entry.id === cardId);
  if (!card) return refuse("Cette carte n'est pas dans votre main.");

  if (current && current.takenCardId !== null && !current.takenCardUsed) {
    const taken = player.hand.find((entry) => entry.id === current.takenCardId);
    return refuse(
      `Cette carte doit être utilisée immédiatement : le ${
        taken ? shortLabel(taken) : 'la carte reprise'
      } doit entrer dans une combinaison avant votre défausse.`,
    );
  }

  return { ok: true, card, finishes: player.hand.length === 1 };
}

/* ------------------------------------------------------------------ */
/* Aides d'interface                                                   */
/* ------------------------------------------------------------------ */

/** Libellé court d'une combinaison construite, pour les annonces. */
export function describeBuilt(meld: BuiltMeld): string {
  return meldLabel({
    kind: meld.kind,
    slots: meld.slots,
    rank: meld.rank,
    suit: meld.suit,
  });
}
