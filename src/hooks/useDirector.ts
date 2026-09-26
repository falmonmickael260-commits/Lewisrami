'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, Rank, StampedEvent } from '@/game/types';
import type { PlayerView } from '@/game/view';
import { sound } from '@/lib/sound';
import { anchorKeys, type Anchor } from '@/components/game/Anchors';
import type { Flight } from '@/components/game/FlightLayer';
import { combinedOffset } from '@/components/game/pileLayout';

export interface CarreMoment {
  playerId: string;
  rank: Rank;
  token: number;
}

export interface Notice {
  id: number;
  text: string;
  tone: 'neutral' | 'good' | 'warn';
}

interface DirectorOptions {
  view: PlayerView | null;
  events: StampedEvent[];
  consumeEvents: (upToSeq: number) => void;
  readAnchor: (key: string) => Anchor | null;
  reducedMotion: boolean;
  pileCardWidth: number;
  handCardWidth: number;
}

export interface Director {
  flights: Flight[];
  onLanded: (id: string) => void;
  settled: Set<string>;
  carre: CarreMoment | null;
  notices: Notice[];
  /** Incrémenté à chaque distribution : déclenche l'entrée animée de la main. */
  dealToken: number;
  lastTrickWinnerId: string | null;
  noteLaunch: (cardId: string, anchor: Anchor) => void;
}

const FLIGHT_DURATION = 0.62;
const QUAD_DURATION = 0.72;

let noticeId = 0;

export function useDirector({
  view,
  events,
  consumeEvents,
  readAnchor,
  reducedMotion,
  pileCardWidth,
  handCardWidth,
}: DirectorOptions): Director {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [settled, setSettled] = useState<Set<string>>(() => new Set());
  const [carre, setCarre] = useState<CarreMoment | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dealToken, setDealToken] = useState(0);
  const [lastTrickWinnerId, setLastTrickWinnerId] = useState<string | null>(null);

  const launchRects = useRef(new Map<string, Anchor>());
  const pendingBySet = useRef(new Map<string, number>());
  const flightSet = useRef(new Map<string, string>());
  const handledSeq = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  const noteLaunch = useCallback((cardId: string, anchor: Anchor) => {
    launchRects.current.set(cardId, anchor);
  }, []);

  const pushNotice = useCallback((text: string, tone: Notice['tone'] = 'neutral') => {
    const notice: Notice = { id: ++noticeId, text, tone };
    setNotices((current) => [...current.slice(-3), notice]);
    setTimeout(() => {
      setNotices((current) => current.filter((n) => n.id !== notice.id));
    }, 3400);
  }, []);

  const settleSet = useCallback((setId: string) => {
    setSettled((current) => {
      if (current.has(setId)) return current;
      const next = new Set(current);
      next.add(setId);
      return next;
    });
  }, []);

  const dropFlights = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const doomed = new Set(ids);
    for (const id of ids) flightSet.current.delete(id);
    setFlights((current) => current.filter((f) => !doomed.has(f.id)));
  }, []);

  const finishSet = useCallback(
    (setId: string) => {
      if (!pendingBySet.current.has(setId)) return;
      pendingBySet.current.delete(setId);
      settleSet(setId);
      const siblings = Array.from(flightSet.current.entries())
        .filter(([, owner]) => owner === setId)
        .map(([id]) => id);
      // On retire les cartes en vol une frame après leur intégration au pli :
      // la carte posée est déjà rendue, il n'y a donc aucun clignotement.
      requestAnimationFrame(() => dropFlights(siblings));
    },
    [dropFlights, settleSet],
  );

  const onLanded = useCallback(
    (flightId: string) => {
      const setId = flightSet.current.get(flightId);
      if (!setId || setId.startsWith('deal:') || setId.startsWith('swap:')) {
        dropFlights([flightId]);
        return;
      }
      const remaining = (pendingBySet.current.get(setId) ?? 1) - 1;
      pendingBySet.current.set(setId, remaining);
      if (remaining > 0) return;
      finishSet(setId);
    },
    [dropFlights, finishSet],
  );

  /* -------------------------------------------------------------- */
  /* Traduction des événements serveur en mouvements                 */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (events.length === 0) return;
    const current = viewRef.current;
    const fresh = events.filter((e) => e.seq > handledSeq.current);
    if (fresh.length === 0) return;
    handledSeq.current = fresh[fresh.length - 1].seq;

    const created: Flight[] = [];

    for (const { seq, event } of fresh) {
      switch (event.type) {
        case 'deal': {
          setDealToken((token) => token + 1);
          setSettled(new Set());
          const deck = readAnchor(anchorKeys.deck);
          if (!deck || reducedMotion || !current) break;

          let index = 0;
          const total = Object.values(event.perPlayer).reduce((a, b) => a + b, 0);
          const step = Math.min(0.055, 2.2 / Math.max(total, 1));
          const maxCards = Math.max(...Object.values(event.perPlayer));

          for (let round = 0; round < maxCards; round++) {
            for (const player of current.players) {
              if ((event.perPlayer[player.id] ?? 0) <= round) continue;
              index++;
              if (player.id === current.youId) continue;
              const seat = readAnchor(anchorKeys.seat(player.id));
              if (!seat) continue;
              const id = `deal:${seq}:${player.id}:${round}`;
              flightSet.current.set(id, `deal:${seq}`);
              created.push({
                id,
                card: null,
                fromX: deck.x,
                fromY: deck.y,
                fromWidth: pileCardWidth * 0.8,
                toX: seat.x,
                toY: seat.y,
                toWidth: pileCardWidth * 0.55,
                rotateFrom: 0,
                rotateTo: (Math.random() - 0.5) * 40,
                delay: index * step,
                duration: 0.42,
                arc: 40,
                bounce: false,
              });
              if (index % 3 === 0) sound().play('deal', { delay: index * step });
            }
          }
          break;
        }

        case 'play': {
          const pile = readAnchor(anchorKeys.pile);
          if (!pile) {
            settleSet(event.setId);
            break;
          }
          const order = current?.pile.length ?? 0;
          const isQuad = event.cards.length === 4;
          const duration = isQuad ? QUAD_DURATION : FLIGHT_DURATION;

          if (reducedMotion) {
            settleSet(event.setId);
            sound().play('land');
            break;
          }

          pendingBySet.current.set(event.setId, event.cards.length);

          event.cards.forEach((card: Card, cardIndex: number) => {
            const source =
              launchRects.current.get(card.id) ??
              readAnchor(anchorKeys.seat(event.playerId)) ??
              readAnchor(anchorKeys.hand) ??
              pile;
            launchRects.current.delete(card.id);

            const offset = combinedOffset(
              event.setId,
              order,
              cardIndex,
              event.cards.length,
              pileCardWidth,
            );
            const delay = cardIndex * (isQuad ? 0.045 : 0.07);
            const id = `play:${seq}:${card.id}`;
            flightSet.current.set(id, event.setId);

            const travel = Math.hypot(pile.x - source.x, pile.y - source.y);
            created.push({
              id,
              card,
              fromX: source.x,
              fromY: source.y,
              fromWidth: source.width || handCardWidth,
              toX: pile.x + offset.dx,
              toY: pile.y + offset.dy,
              toWidth: pileCardWidth,
              rotateFrom: (Math.random() - 0.5) * 26,
              rotateTo: offset.rotate,
              delay,
              duration,
              arc: Math.min(170, 56 + travel * 0.19) * (isQuad ? 1.25 : 1),
              bounce: true,
            });

            sound().play('flick', { delay });
            sound().play('land', { delay: delay + duration * 0.86 });
          });

          // Filet de sécurité : si l'onglet passe en arrière-plan, les animations
          // ne se terminent pas. On intègre alors la pose au pli malgré tout.
          const guardDelay =
            (duration + event.cards.length * (isQuad ? 0.045 : 0.07) + 0.9) * 1000;
          const guardedSetId = event.setId;
          setTimeout(() => finishSet(guardedSetId), guardDelay);

          if (event.isQueenOpening) {
            pushNotice('Dame de pique — la partie commence', 'good');
          }
          break;
        }

        case 'exchange_transfer': {
          const from = readAnchor(anchorKeys.seat(event.fromId));
          const to = readAnchor(anchorKeys.seat(event.toId));
          if (!from || !to || reducedMotion) break;
          for (let i = 0; i < event.count; i++) {
            const id = `swap:${seq}:${i}`;
            flightSet.current.set(id, `swap:${seq}`);
            created.push({
              id,
              card: null,
              fromX: from.x,
              fromY: from.y,
              fromWidth: pileCardWidth * 0.6,
              toX: to.x,
              toY: to.y,
              toWidth: pileCardWidth * 0.6,
              rotateFrom: -20,
              rotateTo: 20,
              delay: i * 0.13,
              duration: 0.72,
              arc: 130,
              bounce: false,
            });
            sound().play('flick', { delay: i * 0.13 });
          }
          break;
        }

        case 'carre':
          setCarre({ playerId: event.playerId, rank: event.rank, token: seq });
          sound().play('carre');
          break;

        case 'trick_won':
          setLastTrickWinnerId(event.playerId);
          break;

        case 'pass':
          sound().play('pass');
          break;

        case 'timeout':
          if (event.playerId === current?.youId) {
            pushNotice('Temps écoulé — coup joué automatiquement', 'warn');
          }
          break;

        case 'player_finished': {
          const name =
            current?.players.find((p) => p.id === event.playerId)?.name ?? 'Un joueur';
          pushNotice(
            event.position === 0 ? `${name} est Président 👑` : `${name} a terminé`,
            event.position === 0 ? 'good' : 'neutral',
          );
          sound().play('finish');
          break;
        }

        case 'turn':
          if (event.playerId === current?.youId) sound().play('turn');
          break;

        case 'round_end':
          sound().play('victory');
          break;

        default:
          break;
      }
    }

    if (created.length > 0) setFlights((currentFlights) => [...currentFlights, ...created]);
    consumeEvents(handledSeq.current);
  }, [
    events,
    consumeEvents,
    readAnchor,
    reducedMotion,
    pileCardWidth,
    handCardWidth,
    pushNotice,
    settleSet,
    finishSet,
  ]);

  /* -------------------------------------------------------------- */
  /* Synchronisation de rattrapage                                   */
  /* -------------------------------------------------------------- */

  // Après une reconnexion, les poses déjà sur la table n'ont jamais été animées :
  // on les considère posées d'office pour éviter un pli vide.
  useEffect(() => {
    if (!view) return;
    const missing = view.pile.filter(
      (set) => !settled.has(set.id) && !pendingBySet.current.has(set.id),
    );
    if (missing.length === 0) return;
    setSettled((current) => {
      const next = new Set(current);
      for (const set of missing) next.add(set.id);
      return next;
    });
  }, [view, settled]);

  return {
    flights,
    onLanded,
    settled,
    carre,
    notices,
    dealToken,
    lastTrickWinnerId,
    noteLaunch,
  };
}
