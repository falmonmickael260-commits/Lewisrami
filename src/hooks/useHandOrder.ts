'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { sortHand, sortHandByRank } from '@/rami/cards';
import type { RamiCard } from '@/rami/types';

export type HandOrder = 'suit' | 'rank';

const STORAGE_KEY = 'rami:ordre-main';

/**
 * Ordre d'affichage de la main.
 *
 * Un joueur de Rami range ses cartes de deux façons selon ce qu'il cherche :
 * **par signe** les tierces sautent aux yeux, **par valeur** ce sont les
 * brelans. Le tri est purement local — le serveur envoie toujours la même main.
 */
export function useHandOrder(hand: readonly RamiCard[]) {
  const [order, setOrder] = useState<HandOrder>('suit');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'rank' || stored === 'suit') setOrder(stored);
    } catch {
      /* navigation privée : on garde l'ordre par défaut */
    }
  }, []);

  const toggle = useCallback(() => {
    setOrder((current) => {
      const next = current === 'suit' ? 'rank' : 'suit';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignoré */
      }
      return next;
    });
  }, []);

  const cards = useMemo(
    () => (order === 'suit' ? sortHand(hand) : sortHandByRank(hand)),
    [hand, order],
  );

  return { order, toggle, cards };
}
