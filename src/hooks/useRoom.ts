'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StampedEvent } from '@/game/types';
import type { PlayerView } from '@/game/view';
import type { ServerMessage } from '@/server/protocol';
import { clearSession, loadSession, saveSession, type StoredSession } from '@/lib/session';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'gone';

export interface RoomHandle {
  view: PlayerView | null;
  status: ConnectionStatus;
  /** Décalage entre l'horloge serveur et l'horloge locale, en millisecondes. */
  clockSkew: number;
  error: string | null;
  events: StampedEvent[];
  consumeEvents: (upToSeq: number) => void;
  send: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  session: StoredSession | null;
  leave: () => void;
}

const MAX_BACKOFF = 8000;

/**
 * Connexion temps réel à une salle.
 *
 * Le serveur pousse une vue complète à chaque mutation : le client n'applique
 * jamais de logique de jeu, il se contente d'afficher et d'animer. La reprise
 * après coupure est donc triviale — la prochaine vue reçue fait autorité.
 */
export function useRoom(code: string): RoomHandle {
  const [view, setView] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StampedEvent[]>([]);
  const [session, setSession] = useState<StoredSession | null>(null);
  const skewRef = useRef(0);
  const [clockSkew, setClockSkew] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    setSession(loadSession(code));
  }, [code]);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'sync': {
        const skew = message.view.serverNow - Date.now();
        skewRef.current = skew;
        setClockSkew(skew);
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
    const stored = loadSession(code);
    setSession(stored);
    const query = stored ? `?token=${encodeURIComponent(stored.token)}` : '';
    const source = new EventSource(`/api/rooms/${code}/stream${query}`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data) as ServerMessage);
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
  }, [code, handleMessage]);

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

  // Un onglet remis au premier plan après une mise en veille doit resynchroniser tout de suite.
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
      const stored = loadSession(code);
      if (!stored) {
        setError('Session expirée. Rejoignez la salle à nouveau.');
        return false;
      }
      try {
        const response = await fetch(`/api/rooms/${code}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action, token: stored.token }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'Action refusée.');
          if (response.status === 401) clearSession(code);
          return false;
        }
        const body = (await response.json()) as { view: PlayerView };
        setView(body.view);
        setError(null);
        return true;
      } catch {
        setError('Connexion perdue. Nouvelle tentative…');
        return false;
      }
    },
    [code],
  );

  const consumeEvents = useCallback((upToSeq: number) => {
    setEvents((current) => current.filter((e) => e.seq > upToSeq));
  }, []);

  const leave = useCallback(() => {
    clearSession(code);
    sourceRef.current?.close();
  }, [code]);

  return {
    view,
    status,
    clockSkew,
    error,
    events,
    consumeEvents,
    send,
    session,
    leave,
  };
}

export { saveSession };
