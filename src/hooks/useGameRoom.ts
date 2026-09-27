'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearSession,
  loadSession,
  type GameNamespace,
  type StoredSession,
} from '@/lib/session';

/** Enveloppe horodatée d'un événement, identique pour les deux jeux. */
export interface Stamped<E> {
  seq: number;
  at: number;
  event: E;
}

type Message<V, E> =
  | { type: 'sync'; view: V; events: Stamped<E>[]; seq: number }
  | { type: 'error'; message: string }
  | { type: 'ping'; at: number }
  | { type: 'closed'; reason: string };

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'gone';

export interface GameRoomHandle<V, E> {
  view: V | null;
  status: ConnectionStatus;
  /** Décalage entre l'horloge serveur et l'horloge locale, en millisecondes. */
  clockSkew: number;
  error: string | null;
  clearError: () => void;
  events: Stamped<E>[];
  consumeEvents: (upToSeq: number) => void;
  send: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  session: StoredSession | null;
  leave: () => void;
}

const MAX_BACKOFF = 8000;

/**
 * Connexion temps réel à une salle, commune au Président et au Rami.
 *
 * Le serveur pousse une vue complète à chaque mutation : le client n'applique
 * jamais de logique de jeu, il se contente d'afficher et d'animer. La reprise
 * après coupure est donc triviale — la prochaine vue reçue fait autorité.
 *
 * `apiBase` désigne la racine REST du jeu (`/api/rooms` ou `/api/rami/rooms`) et
 * `namespace` cloisonne les jetons dans le stockage local.
 */
export function useGameRoom<V extends { serverNow: number }, E>(
  code: string,
  apiBase: string,
  namespace: GameNamespace,
): GameRoomHandle<V, E> {
  const [view, setView] = useState<V | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Stamped<E>[]>([]);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [clockSkew, setClockSkew] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    setSession(loadSession(code, namespace));
  }, [code, namespace]);

  const handleMessage = useCallback((message: Message<V, E>) => {
    switch (message.type) {
      case 'sync': {
        setClockSkew(message.view.serverNow - Date.now());
        setView(message.view);
        setStatus('live');
        retryRef.current = 0;
        if (message.events.length > 0) {
          setEvents((current) => [...current, ...message.events].slice(-60));
        }
        break;
      }
      case 'ping':
        setClockSkew(message.at - Date.now());
        break;
      case 'error':
        setError(message.message);
        break;
      case 'closed':
        setStatus('gone');
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!aliveRef.current) return;
    const stored = loadSession(code, namespace);
    setSession(stored);
    const query = stored ? `?token=${encodeURIComponent(stored.token)}` : '';
    const source = new EventSource(`${apiBase}/${code}/stream${query}`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data) as Message<V, E>);
      } catch {
        /* trame illisible : la suivante fera autorité */
      }
    };

    source.onerror = () => {
      source.close();
      sourceRef.current = null;
      if (!aliveRef.current) return;
      setStatus('reconnecting');
      // Repli exponentiel plafonné : on ne martèle jamais le serveur.
      const delay = Math.min(MAX_BACKOFF, 600 * 2 ** retryRef.current);
      retryRef.current = Math.min(retryRef.current + 1, 5);
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [code, apiBase, namespace, handleMessage]);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);

  // Un onglet remis au premier plan après une veille doit resynchroniser tout de suite.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (sourceRef.current && sourceRef.current.readyState === EventSource.OPEN) return;
      sourceRef.current?.close();
      sourceRef.current = null;
      retryRef.current = 0;
      connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [connect]);

  const send = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      const stored = loadSession(code, namespace);
      if (!stored) {
        setError('Session expirée. Rejoignez la salle à nouveau.');
        return false;
      }
      try {
        const response = await fetch(`${apiBase}/${code}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action, token: stored.token }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'Action refusée.');
          if (response.status === 401) clearSession(code, namespace);
          return false;
        }
        const body = (await response.json()) as { view: V };
        setView(body.view);
        setError(null);
        return true;
      } catch {
        setError('Connexion perdue. Nouvelle tentative…');
        return false;
      }
    },
    [code, apiBase, namespace],
  );

  const consumeEvents = useCallback((upToSeq: number) => {
    setEvents((current) => current.filter((entry) => entry.seq > upToSeq));
  }, []);

  const leave = useCallback(() => {
    clearSession(code, namespace);
    sourceRef.current?.close();
  }, [code, namespace]);

  const clearError = useCallback(() => setError(null), []);

  return {
    view,
    status,
    clockSkew,
    error,
    clearError,
    events,
    consumeEvents,
    send,
    session,
    leave,
  };
}
