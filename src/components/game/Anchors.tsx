'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

export interface Anchor {
  /** Centre de l'élément, en coordonnées viewport. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnchorApi {
  bind: (key: string) => (element: HTMLElement | null) => void;
  read: (key: string) => Anchor | null;
}

const AnchorContext = createContext<AnchorApi | null>(null);

/**
 * Registre des points d'ancrage de la table (sièges, pioche, pli, main).
 * Les trajectoires de cartes sont calculées à partir de positions réelles
 * mesurées dans le DOM : aucune carte ne « téléporte ».
 */
export function AnchorProvider({ children }: { children: ReactNode }) {
  const elements = useRef(new Map<string, HTMLElement>());

  const bind = useCallback(
    (key: string) => (element: HTMLElement | null) => {
      if (element) elements.current.set(key, element);
      else elements.current.delete(key);
    },
    [],
  );

  const read = useCallback((key: string): Anchor | null => {
    const element = elements.current.get(key);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  }, []);

  const api = useMemo(() => ({ bind, read }), [bind, read]);
  return <AnchorContext.Provider value={api}>{children}</AnchorContext.Provider>;
}

export function useAnchors(): AnchorApi {
  const context = useContext(AnchorContext);
  if (!context) throw new Error('useAnchors doit être utilisé dans un AnchorProvider');
  return context;
}

export const anchorKeys = {
  seat: (playerId: string) => `seat:${playerId}`,
  pile: 'pile',
  deck: 'deck',
  hand: 'hand',
  card: (cardId: string) => `card:${cardId}`,
  /* Rami */
  stock: 'stock',
  discard: 'discard',
  meld: (meldId: string) => `meld:${meldId}`,
};
