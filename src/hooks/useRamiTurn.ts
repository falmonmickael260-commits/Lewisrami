'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildMeld, extendMeldWith, guessKind, qualifiesAsOpeningRun } from '@/rami/melds';
import { findLayDown, findReclaims } from '@/rami/solver';
import type { CardId, Meld, MeldProposal, RamiCard } from '@/rami/types';
import type { RamiPlayerView } from '@/rami/view';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import type { MeldAffordance } from '@/components/rami/MeldView';

/** Combinaison préparée mais pas encore posée. */
export interface StagedGroup {
  id: string;
  proposal: MeldProposal;
  cards: RamiCard[];
  points: number;
  qualifiesRun: boolean;
  label: string;
}

export interface RamiTurnState {
  selected: CardId[];
  selectedCards: RamiCard[];
  toggle: (cardId: CardId) => void;
  clearSelection: () => void;

  groups: StagedGroup[];
  addGroup: () => void;
  removeGroup: (id: string) => void;
  clearGroups: () => void;

  /** Cartes immobilisées dans un groupe en attente. */
  reservedIds: ReadonlySet<CardId>;

  /** Combinaisons détectées automatiquement dans la main, sans sélection. */
  handGroups: { id: string; cardIds: CardId[]; label: string; colorIndex: number }[];
  /** Sélectionne d'un coup toutes les cartes d'un groupe détecté. */
  selectHandGroup: (cardIds: CardId[]) => void;

  /** Ce que la sélection courante formerait, et pourquoi elle échoue. */
  selectionHint: { valid: boolean; text: string | null; points: number };

  stagedPoints: number;
  stagedHasRun: boolean;
  /** Points minimum à atteindre pour cette pose, `null` si le joueur est déjà entré. */
  requiredPoints: number | null;
  canLay: boolean;
  layHint: string | null;
  proposals: MeldProposal[];

  affordanceFor: (meld: Meld) => MeldAffordance;
  /** Cartes à poser pour récupérer le joker d'une combinaison. */
  reclaimFor: (meldId: string) => CardId[] | null;

  /** Meilleure pose trouvée par le solveur, proposée au joueur. */
  suggestion: {
    melds: MeldProposal[];
    points: number;
    emptiesHand: boolean;
    leftoverCardId: CardId | null;
  } | null;
  applySuggestion: () => void;

  canDiscard: boolean;
}

let groupCounter = 0;

/** Nom d'une combinaison préparée, affiché sur le plan de travail. */
function labelFor(kind: 'run' | 'set', size: number): string {
  if (kind === 'run') return 'Tierce';
  return size >= 4 ? 'Carré' : 'Brelan';
}

/**
 * État d'un tour de Rami côté joueur.
 *
 * Toute la validation faite ici est **locale et immédiate**, pour guider la
 * main : le serveur revalide systématiquement. Aucun coup n'est jamais autorisé
 * par ce fichier.
 */
export function useRamiTurn(view: RamiPlayerView | null, isMyTurn: boolean): RamiTurnState {
  const [selected, setSelected] = useState<CardId[]>([]);
  const [groups, setGroups] = useState<StagedGroup[]>([]);

  const hand = useMemo(() => view?.hand ?? [], [view?.hand]);
  const handById = useMemo(() => new Map(hand.map((card) => [card.id, card])), [hand]);

  // Une sélection ne survit jamais à un changement de tour, de manche ou de phase.
  useEffect(() => {
    setSelected([]);
    setGroups([]);
  }, [view?.currentPlayerId, view?.phase, view?.roundNumber]);

  // Une carte qui a quitté la main ne peut pas rester sélectionnée ou réservée.
  useEffect(() => {
    setSelected((current) => current.filter((id) => handById.has(id)));
    setGroups((current) =>
      current.filter((group) => group.proposal.cardIds.every((id) => handById.has(id))),
    );
  }, [handById]);

  const reservedIds = useMemo(() => {
    const set = new Set<CardId>();
    for (const group of groups) {
      for (const id of group.proposal.cardIds) set.add(id);
    }
    return set;
  }, [groups]);

  /**
   * Combinaisons présentes dans la main, détectées sans sélection préalable.
   *
   * Indépendant du seuil d'ouverture (71 points, tierce obligatoire) : ceci
   * n'affiche qu'un repère visuel, la validité réelle pour poser reste
   * vérifiée par le serveur au moment du clic sur « Poser ».
   */
  const handGroups = useMemo(() => {
    const detectable = hand.filter((card) => !reservedIds.has(card.id));
    if (detectable.length < 3) return [];
    const lay = findLayDown(detectable, { keepAtLeast: 0 });
    if (!lay) return [];
    return lay.melds.map((proposal, index) => ({
      id: `auto-${index}`,
      cardIds: proposal.cardIds,
      label: labelFor(proposal.kind, proposal.cardIds.length),
      colorIndex: index % 4,
    }));
  }, [hand, reservedIds]);

  const selectedCards = useMemo(
    () =>
      selected
        .map((id) => handById.get(id))
        .filter((card): card is RamiCard => Boolean(card)),
    [selected, handById],
  );

  const toggle = useCallback(
    (cardId: CardId) => {
      if (reservedIds.has(cardId)) return;
      setSelected((current) => {
        if (current.includes(cardId)) {
          sound().play('deselect');
          haptic('tap');
          return current.filter((id) => id !== cardId);
        }
        sound().play('select');
        haptic('select');
        return [...current, cardId];
      });
    },
    [reservedIds],
  );

  const clearSelection = useCallback(() => setSelected([]), []);
  const clearGroups = useCallback(() => setGroups([]), []);

  const selectHandGroup = useCallback((cardIds: CardId[]) => {
    setSelected(cardIds);
    sound().play('select');
    haptic('select');
  }, []);

  /* ---------------------------------------------------------------- */
  /* Aperçu de la sélection                                            */
  /* ---------------------------------------------------------------- */

  const preview = useMemo(() => {
    if (selectedCards.length === 0) return null;
    return guessKind(selectedCards, view?.youId ?? 'me');
  }, [selectedCards, view?.youId]);

  const keepOne = useMemo(() => {
    if (!view) return false;
    return hand.length - reservedIds.size - selected.length < 1;
  }, [view, hand.length, reservedIds.size, selected.length]);

  const selectionHint = useMemo(() => {
    if (selectedCards.length === 0) {
      return { valid: false, text: null, points: 0 };
    }
    if (selectedCards.length < 3) {
      return {
        valid: false,
        text: 'Une combinaison compte au moins 3 cartes.',
        points: 0,
      };
    }
    if (!preview || !preview.ok) {
      return { valid: false, text: preview?.ok === false ? preview.message : null, points: 0 };
    }
    if (keepOne) {
      return {
        valid: false,
        text: 'Gardez une carte à jeter : une manche ne se finit jamais sans défausse.',
        points: preview.points,
      };
    }
    return {
      valid: true,
      text: `${preview.kind === 'run' ? 'Tierce' : preview.slots.length >= 4 ? 'Carré' : 'Brelan'} · ${preview.points} pts`,
      points: preview.points,
    };
  }, [selectedCards.length, preview, keepOne]);

  const addGroup = useCallback(() => {
    if (!preview || !preview.ok || keepOne) return;
    const cards = selectedCards.slice();

    // On fige ce que le joker représente : sans cette précision, le serveur
    // pourrait le placer à l'autre extrémité de la tierce.
    const jokerRole = preview.slots.find((slot) => slot.card.joker)?.jokerRole ?? null;

    const group: StagedGroup = {
      id: `g${++groupCounter}`,
      proposal: {
        kind: preview.kind,
        cardIds: cards.map((card) => card.id),
        ...(jokerRole
          ? { jokerRank: jokerRole.rank, jokerSuit: jokerRole.suit ?? undefined }
          : {}),
      },
      cards,
      points: preview.points,
      qualifiesRun: qualifiesAsOpeningRun({ kind: preview.kind, slots: preview.slots } as Meld),
      label: labelFor(preview.kind, preview.slots.length),
    };
    setGroups((current) => [...current, group]);
    setSelected([]);
    sound().play('select');
    haptic('select');
  }, [preview, keepOne, selectedCards]);

  const removeGroup = useCallback((id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id));
    sound().play('deselect');
  }, []);

  /* ---------------------------------------------------------------- */
  /* Pose                                                              */
  /* ---------------------------------------------------------------- */

  const stagedPoints = useMemo(
    () => groups.reduce((sum, group) => sum + group.points, 0),
    [groups],
  );
  const stagedHasRun = useMemo(
    () => groups.some((group) => group.qualifiesRun),
    [groups],
  );
  const requiredPoints = view?.hints.openingPoints ?? null;
  const requiresRun = view?.hints.requiresOpeningRun ?? false;

  const layHint = useMemo(() => {
    if (groups.length === 0) return null;
    if (requiresRun && !stagedHasRun) {
      return requiredPoints === 0
        ? 'Votre première pose doit contenir une tierce de trois vraies cartes.'
        : 'Il manque une tierce de trois vraies cartes (un joker ne compte pas).';
    }
    if (requiredPoints !== null && stagedPoints < requiredPoints) {
      return `Il faut ${requiredPoints} points — vous en avez ${stagedPoints}.`;
    }
    return null;
  }, [groups.length, requiresRun, stagedHasRun, requiredPoints, stagedPoints]);

  const canLay = groups.length > 0 && layHint === null && isMyTurn;

  const proposals = useMemo(() => groups.map((group) => group.proposal), [groups]);

  /* ---------------------------------------------------------------- */
  /* Combinaisons de la table                                          */
  /* ---------------------------------------------------------------- */

  const touchable = useCallback(
    (meld: Meld) => {
      if (!view || !view.hints.canExtend) return false;
      const me = view.players.find((player) => player.id === view.youId);
      if (!me) return false;
      if (meld.teamId === me.teamId) return true;
      return view.hints.canTouchOpponents;
    },
    [view],
  );

  const reclaims = useMemo(() => {
    if (!view || !isMyTurn || !view.hints.canExtend) return new Map<string, CardId[]>();
    const me = view.players.find((player) => player.id === view.youId);
    if (!me) return new Map<string, CardId[]>();
    const options = findReclaims(hand, view.melds, {
      teamId: me.teamId,
      allowOpponents: view.hints.canTouchOpponents,
    });
    return new Map(options.map((option) => [option.meldId, option.cardIds]));
  }, [view, isMyTurn, hand]);

  const affordanceFor = useCallback(
    (meld: Meld): MeldAffordance => {
      if (!isMyTurn) return 'none';
      if (!touchable(meld)) return 'none';
      if (selectedCards.length === 0) {
        return reclaims.has(meld.id) ? 'reclaim' : 'none';
      }
      if (hand.length - reservedIds.size - selectedCards.length < 1) return 'blocked';
      return extendMeldWith(meld, selectedCards).ok ? 'extend' : 'blocked';
    },
    [isMyTurn, touchable, selectedCards, reclaims, hand.length, reservedIds.size],
  );

  const reclaimFor = useCallback(
    (meldId: string) => reclaims.get(meldId) ?? null,
    [reclaims],
  );

  /* ---------------------------------------------------------------- */
  /* Suggestion du solveur                                             */
  /* ---------------------------------------------------------------- */

  const suggestion = useMemo(() => {
    if (!view || !isMyTurn || view.turn?.stage !== 'meld') return null;
    if (groups.length > 0) return null;
    const lay = findLayDown(hand, {
      minPoints: view.hints.openingPoints ?? 0,
      requireRun: view.hints.requiresOpeningRun,
      keepAtLeast: 1,
      mustInclude: view.hints.mustUseTakenCard
        ? (view.turn?.takenCardId ?? undefined)
        : undefined,
    });
    if (!lay) return null;
    // Une manche ne se termine jamais sans défausse : « toute la main » veut
    // dire toutes les cartes sauf celle qui restera à jeter.
    const usedIds = new Set(lay.melds.flatMap((meld) => meld.cardIds));
    const emptiesHand = hand.length > 0 && usedIds.size >= hand.length - 1;
    // La seule carte qui resterait en main : celle à jeter pour finir la manche.
    const leftoverCardId = emptiesHand
      ? (hand.find((card) => !usedIds.has(card.id))?.id ?? null)
      : null;
    return { melds: lay.melds, points: lay.points, emptiesHand, leftoverCardId };
  }, [view, isMyTurn, hand, groups.length]);

  const applySuggestion = useCallback(() => {
    if (!suggestion) return;
    const staged: StagedGroup[] = [];
    for (const proposal of suggestion.melds) {
      const cards = proposal.cardIds
        .map((id) => handById.get(id))
        .filter((card): card is RamiCard => Boolean(card));
      const built = buildMeld(proposal, cards, view?.youId ?? 'me');
      if (!built.ok) continue;
      staged.push({
        id: `g${++groupCounter}`,
        proposal,
        cards,
        points: built.points,
        qualifiesRun: qualifiesAsOpeningRun({ kind: built.kind, slots: built.slots } as Meld),
        label: labelFor(built.kind, built.slots.length),
      });
    }
    setGroups(staged);
    setSelected([]);
    sound().play('select');
    haptic('select');
  }, [suggestion, handById, view?.youId]);

  const canDiscard =
    isMyTurn &&
    view?.turn?.stage === 'meld' &&
    selected.length === 1 &&
    groups.length === 0 &&
    !view.hints.mustUseTakenCard;

  return {
    selected,
    selectedCards,
    toggle,
    clearSelection,
    groups,
    addGroup,
    removeGroup,
    clearGroups,
    reservedIds,
    handGroups,
    selectHandGroup,
    selectionHint,
    stagedPoints,
    stagedHasRun,
    requiredPoints,
    canLay,
    layHint,
    proposals,
    affordanceFor,
    reclaimFor,
    suggestion,
    applySuggestion,
    canDiscard,
  };
}
