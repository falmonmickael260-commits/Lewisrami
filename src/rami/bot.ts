/**
 * Bots du Rami.
 *
 * Ils permettent de jouer seul et de tester une partie complète de bout en bout.
 * Ils n'ont **aucun privilège** : ils passent par les mêmes actions et la même
 * validation que les joueurs humains, et ne voient jamais que leur propre main.
 *
 * Leur stratégie est volontairement lisible plutôt que maximale :
 * 1. reprendre la carte de la défausse **seulement** si elle est utilisable
 *    immédiatement, puisque la règle l'exige ;
 * 2. ouvrir dès que le seuil est atteignable ;
 * 3. compléter la table, récupérer un joker quand c'est rentable ;
 * 4. jeter la carte la plus chère qui ne sert à rien.
 */

import { handPoints } from './cards';
import { leastUsefulCard } from './engine';
import {
  validateDiscard,
  validateExtend,
  validateLayMelds,
  validateReclaim,
} from './moves';
import { openingRequirementFor } from './scoring';
import {
  findExtensions,
  findLayDown,
  findReclaims,
  orphanCards,
  type LayDown,
} from './solver';
import type { CardId, RamiAction, RamiCard, RamiPlayer, RamiState } from './types';

interface Context {
  state: RamiState;
  player: RamiPlayer;
  hand: RamiCard[];
  teamId: number;
  canExtend: boolean;
  allowOpponents: boolean;
}

function contextFor(state: RamiState, player: RamiPlayer): Context {
  const team = state.teams.find((entry) => entry.id === player.teamId);
  return {
    state,
    player,
    hand: player.hand,
    teamId: player.teamId,
    canExtend: Boolean(player.hasEntered && team?.opening.opened),
    allowOpponents: Boolean(
      player.hasEntered && state.teams.every((entry) => entry.opening.opened),
    ),
  };
}

/** Pose que ce joueur pourrait réaliser maintenant, en respectant son seuil. */
function planLayDown(context: Context, mustInclude?: CardId): LayDown | null {
  const requirement = openingRequirementFor(context.state, context.player);
  return findLayDown(context.hand, {
    minPoints: requirement?.points ?? 0,
    requireRun: requirement?.requiresRun ?? false,
    keepAtLeast: 1,
    mustInclude,
  });
}

/**
 * Cette carte peut-elle être utilisée immédiatement ?
 *
 * C'est la question à trancher avant de reprendre la défausse : une carte
 * reprise qui ne sert à rien bloque le tour (règle 9).
 */
export function canUseImmediately(
  state: RamiState,
  player: RamiPlayer,
  card: RamiCard,
): boolean {
  const hand = [...player.hand, card];
  const context = { ...contextFor(state, player), hand };

  const lay = findLayDown(hand, {
    minPoints: openingRequirementFor(state, player)?.points ?? 0,
    requireRun: openingRequirementFor(state, player)?.requiresRun ?? false,
    keepAtLeast: 1,
    mustInclude: card.id,
  });
  if (lay) return true;

  if (!context.canExtend) return false;

  const extensions = findExtensions(hand, state.melds, {
    teamId: player.teamId,
    allowOpponents: context.allowOpponents,
  });
  if (extensions.some((option) => option.cardIds.includes(card.id))) return true;

  const reclaims = findReclaims(hand, state.melds, {
    teamId: player.teamId,
    allowOpponents: context.allowOpponents,
  });
  return reclaims.some((option) => option.cardIds.includes(card.id));
}

/** Carte à jeter : la plus chère parmi celles qui ne servent à rien. */
export function chooseDiscard(context: Context): RamiCard | null {
  const { hand } = context;
  if (hand.length === 0) return null;
  if (hand.length === 1) return hand[0];

  const orphans = orphanCards(hand).filter((card) => !card.joker);
  if (orphans.length > 0) {
    return orphans.reduce((worst, card) =>
      handPoints(card) > handPoints(worst) ? card : worst,
    );
  }

  const fallback = leastUsefulCard(hand);
  if (fallback && !fallback.joker) return fallback;
  return hand.find((card) => !card.joker) ?? hand[0];
}

/* ------------------------------------------------------------------ */
/* Décision                                                           */
/* ------------------------------------------------------------------ */

/**
 * Prochaine action du bot, ou `null` s'il n'a rien à faire.
 *
 * Le planificateur serveur appelle cette fonction une action à la fois : chaque
 * coup est donc animé séparément, comme celui d'un humain.
 */
export function decideBotAction(state: RamiState, playerId: string): RamiAction | null {
  if (state.phase !== 'playing') return null;
  if (state.currentPlayerId !== playerId) return null;

  const player = state.players.find((entry) => entry.id === playerId);
  const turn = state.turn;
  if (!player || !turn) return null;

  const context = contextFor(state, player);

  /* --- Étape 1 : pioche ou reprise ------------------------------- */
  if (turn.stage === 'draw') {
    const top = state.discard[state.discard.length - 1];
    if (top && canUseImmediately(state, player, top)) {
      return { type: 'take_discard', playerId };
    }
    if (state.stock.length > 0 || state.discard.length > 1) {
      return { type: 'draw_stock', playerId };
    }
    return null;
  }

  /* --- Étape 2 : honorer une carte reprise ----------------------- */
  if (turn.takenCardId !== null && !turn.takenCardUsed) {
    const takenId = turn.takenCardId;

    const lay = planLayDown(context, takenId);
    if (lay && validateLayMelds(state, playerId, lay.melds).ok) {
      return { type: 'lay_melds', playerId, melds: lay.melds };
    }

    if (context.canExtend) {
      const extension = findExtensions(context.hand, state.melds, {
        teamId: context.teamId,
        allowOpponents: context.allowOpponents,
      }).find((option) => option.cardIds.includes(takenId));
      if (
        extension &&
        validateExtend(state, playerId, extension.meldId, extension.cardIds).ok
      ) {
        return {
          type: 'extend_meld',
          playerId,
          meldId: extension.meldId,
          cardIds: extension.cardIds,
        };
      }

      const reclaim = findReclaims(context.hand, state.melds, {
        teamId: context.teamId,
        allowOpponents: context.allowOpponents,
      }).find((option) => option.cardIds.includes(takenId));
      if (
        reclaim &&
        validateReclaim(state, playerId, reclaim.meldId, reclaim.cardIds).ok
      ) {
        return {
          type: 'reclaim_joker',
          playerId,
          meldId: reclaim.meldId,
          cardIds: reclaim.cardIds,
        };
      }
    }

    // Rien à en faire : on la remet en place plutôt que de bloquer le tour.
    return { type: 'cancel_take', playerId };
  }

  /* --- Étape 3 : poser ------------------------------------------- */
  const lay = planLayDown(context);
  if (lay && validateLayMelds(state, playerId, lay.melds).ok) {
    return { type: 'lay_melds', playerId, melds: lay.melds };
  }

  /* --- Étape 4 : compléter la table ------------------------------ */
  if (context.canExtend) {
    for (const option of findExtensions(context.hand, state.melds, {
      teamId: context.teamId,
      allowOpponents: context.allowOpponents,
    })) {
      if (validateExtend(state, playerId, option.meldId, option.cardIds).ok) {
        return {
          type: 'extend_meld',
          playerId,
          meldId: option.meldId,
          cardIds: option.cardIds,
        };
      }
    }

    // Un joker vaut 25 points en main : on ne le récupère que si on peut le
    // reposer tout de suite, sinon il devient un boulet en fin de manche.
    for (const option of findReclaims(context.hand, state.melds, {
      teamId: context.teamId,
      allowOpponents: context.allowOpponents,
    })) {
      if (!validateReclaim(state, playerId, option.meldId, option.cardIds).ok) continue;
      const after = context.hand.filter((card) => !option.cardIds.includes(card.id));
      const joker = { id: 'probe', rank: null, suit: null, joker: true, deck: 0 } as RamiCard;
      const replay = findLayDown([...after, joker], { keepAtLeast: 1 });
      if (replay) {
        return {
          type: 'reclaim_joker',
          playerId,
          meldId: option.meldId,
          cardIds: option.cardIds,
        };
      }
    }
  }

  /* --- Étape 5 : défausse obligatoire ---------------------------- */
  const card = chooseDiscard(context);
  if (card && validateDiscard(state, playerId, card.id).ok) {
    return { type: 'discard', playerId, cardId: card.id };
  }

  // Filet de sécurité : n'importe quelle carte jetable vaut mieux qu'un blocage.
  for (const entry of context.hand) {
    if (validateDiscard(state, playerId, entry.id).ok) {
      return { type: 'discard', playerId, cardId: entry.id };
    }
  }

  return null;
}

/** Le bot a-t-il quelque chose à faire ? Utilisé par le planificateur serveur. */
export function botPendingPlayerId(state: RamiState): string | null {
  if (state.phase !== 'playing' || !state.currentPlayerId) return null;
  const current = state.players.find((player) => player.id === state.currentPlayerId);
  return current?.isBot ? current.id : null;
}
