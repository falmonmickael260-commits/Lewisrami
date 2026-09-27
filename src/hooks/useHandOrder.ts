'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sortHand, sortHandByRank } from '@/rami/cards';
import type { CardId, RamiCard } from '@/rami/types';

/** `manual` : l'ordre voulu par le joueur, qui prime sur tout tri automatique. */
export type HandOrder = 'suit' | 'rank' | 'manual';

const STORAGE_KEY = 'rami:ordre-main';

export interface HandOrderState {
  order: HandOrder;
  cards: RamiCard[];
  /** Bascule entre le tri par signe et le tri par valeur, et oublie l'ordre manuel. */
  toggle: () => void;
  /** Déplace une carte à une nouvelle place dans la main. */
  move: (cardId: CardId, toIndex: number) => void;
}

/**
 * Ordre d'affichage de la main.
 *
 * Trois rangements, parce qu'un joueur de Rami passe de l'un à l'autre :
 * **par signe** les tierces sautent aux yeux, **par valeur** ce sont les
 * brelans, et **à la main** on arrange comme on veut — c'est ce qu'on fait
 * devant une vraie table, et c'est ce qui prime dès qu'on y touche.
 *
 * Tout est local : le serveur envoie toujours la même main, dans le même ordre.
 */
export function useHandOrder(hand: readonly RamiCard[]): HandOrderState {
  const [order, setOrder] = useState<HandOrder>('suit');
  const [manual, setManual] = useState<CardId[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'rank' || stored === 'suit') setOrder(stored);
    } catch {
      /* navigation privée : on garde l'ordre par défaut */
    }
  }, []);

  const toggle = useCallback(() => {
    setManual([]);
    setOrder((current) => {
      const next = current === 'rank' ? 'suit' : 'rank';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignoré */
      }
      return next;
    });
  }, []);

  const automatic = useMemo(
    () => (order === 'rank' ? sortHandByRank(hand) : sortHand(hand)),
    [hand, order],
  );

  /**
   * L'ordre manuel survit aux cartes qui arrivent et qui partent : une carte
   * inconnue se range à la fin — là où on la pose en la prenant — et une carte
   * jouée disparaît sans décaler le reste.
   */
  const cards = useMemo(() => {
    if (order !== 'manual' || manual.length === 0) return automatic;
    const byId = new Map(hand.map((card) => [card.id, card]));
    const out: RamiCard[] = [];
    for (const id of manual) {
      const card = byId.get(id);
      if (card) {
        out.push(card);
        byId.delete(id);
      }
    }
    for (const card of hand) {
      if (byId.has(card.id)) out.push(card);
    }
    return out;
  }, [order, manual, hand, automatic]);

  const move = useCallback(
    (cardId: CardId, toIndex: number) => {
      setManual(() => {
        const current = cards.map((card) => card.id);
        const from = current.indexOf(cardId);
        if (from === -1) return current;
        const target = Math.max(0, Math.min(current.length - 1, toIndex));
        if (from === target) return current;
        current.splice(from, 1);
        current.splice(target, 0, cardId);
        return current;
      });
      setOrder('manual');
    },
    [cards],
  );

  return { order, cards, toggle, move };
}
