'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { shortLabel } from '@/rami/cards';
import { MODE_LABELS } from '@/rami/scoring';
import type { CardId, RamiCard, RamiEvent } from '@/rami/types';
import type { RamiPlayerView } from '@/rami/view';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { anchorKeys, type Anchor } from '@/components/game/Anchors';
import type { Flight } from '@/components/game/FlightLayer';

import type { Stamped } from './useGameRoom';

export interface Notice {
  id: number;
  text: string;
  tone: 'neutral' | 'good' | 'warn';
}

interface DirectorOptions {
  view: RamiPlayerView | null;
  events: Stamped<RamiEvent>[];
  consumeEvents: (upToSeq: number) => void;
  readAnchor: (key: string) => Anchor | null;
  reducedMotion: boolean;
  tableCardWidth: number;
  handCardWidth: number;
}

export interface RamiDirector {
  flights: Flight<RamiCard>[];
  onLanded: (id: string) => void;
  notices: Notice[];
  pushNotice: (text: string, tone?: Notice['tone']) => void;
  /** Cartes en vol vers la table : masquées à destination le temps du trajet. */
  pendingCardIds: ReadonlySet<CardId>;
  /** Cartes qui viennent d'atterrir : elles entrent en animation. */
  freshCardIds: ReadonlySet<CardId>;
  /** Incrémenté à chaque distribution : déclenche l'entrée animée de la main. */
  dealToken: number;
  /** Point de départ de l'entrée d'une carte dans la main, relatif à la main. */
  handOrigin: { dx: number; dy: number };
  /** Mémorise la position d'une carte avant qu'elle ne quitte la main. */
  captureCards: (ids: readonly CardId[]) => void;
  /** Dernière annonce d'ouverture, pour l'effet de mise en avant. */
  openingMoment: { playerId: string; points: number; token: number } | null;
}

const FLIGHT_DURATION = 0.56;
let noticeId = 0;

/**
 * Traduit les événements du serveur en mouvements.
 *
 * Aucune décision de jeu ici : le metteur en scène ne fait qu'**illustrer** ce
 * qui s'est déjà produit côté serveur. Les cartes partent et arrivent à des
 * positions réellement mesurées dans le DOM, jamais estimées — une carte ne
 * « téléporte » donc jamais.
 */
export function useRamiDirector({
  view,
  events,
  consumeEvents,
  readAnchor,
  reducedMotion,
  tableCardWidth,
  handCardWidth,
}: DirectorOptions): RamiDirector {
  const [flights, setFlights] = useState<Flight<RamiCard>[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pendingCardIds, setPendingCardIds] = useState<ReadonlySet<CardId>>(new Set());
  const [freshCardIds, setFreshCardIds] = useState<ReadonlySet<CardId>>(new Set());
  const [dealToken, setDealToken] = useState(0);
  const [handOrigin, setHandOrigin] = useState({ dx: 0, dy: 90 });
  const [openingMoment, setOpeningMoment] = useState<RamiDirector['openingMoment']>(null);

  const launchRects = useRef(new Map<CardId, Anchor>());
  const flightCards = useRef(new Map<string, CardId>());
  const handledSeq = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  const pushNotice = useCallback((text: string, tone: Notice['tone'] = 'neutral') => {
    const notice: Notice = { id: ++noticeId, text, tone };
    setNotices((current) => [...current.slice(-3), notice]);
    setTimeout(() => {
      setNotices((current) => current.filter((entry) => entry.id !== notice.id));
    }, 3600);
  }, []);

  const captureCards = useCallback(
    (cardIds: readonly CardId[]) => {
      for (const id of cardIds) {
        const anchor = readAnchor(anchorKeys.card(id));
        if (anchor) launchRects.current.set(id, anchor);
      }
    },
    [readAnchor],
  );

  const onLanded = useCallback((flightId: string) => {
    const cardId = flightCards.current.get(flightId);
    flightCards.current.delete(flightId);
    setFlights((current) => current.filter((flight) => flight.id !== flightId));
    if (!cardId) return;
    setPendingCardIds((current) => {
      if (!current.has(cardId)) return current;
      const next = new Set(current);
      next.delete(cardId);
      return next;
    });
    setFreshCardIds((current) => new Set(current).add(cardId));
    setTimeout(() => {
      setFreshCardIds((current) => {
        if (!current.has(cardId)) return current;
        const next = new Set(current);
        next.delete(cardId);
        return next;
      });
    }, 700);
  }, []);

  useEffect(() => {
    if (events.length === 0) return;
    const fresh = events.filter((entry) => entry.seq > handledSeq.current);
    if (fresh.length === 0) return;
    handledSeq.current = fresh[fresh.length - 1].seq;
    const consumeTo = handledSeq.current;

    // Les cartes destinées à la table sont marquées « en vol » tout de suite :
    // sans cela elles s'afficheraient à destination avant d'y être arrivées.
    if (!reducedMotion) {
      const incoming = new Set<CardId>();
      for (const { event } of fresh) {
        if (event.type === 'meld_extended') {
          for (const card of event.cards) incoming.add(card.id);
        }
        if (event.type === 'joker_reclaimed') {
          for (const card of event.replacedBy) incoming.add(card.id);
        }
        if (event.type === 'discard') incoming.add(event.card.id);
      }
      if (incoming.size > 0) {
        setPendingCardIds((current) => new Set([...current, ...incoming]));
      }
    }

    // On attend une frame : au montage de la table la mise en page n'est pas
    // stabilisée, et les ancres seraient lues au mauvais endroit.
    requestAnimationFrame(() => {
      const current = viewRef.current;
      const created: Flight<RamiCard>[] = [];

      const sourceFor = (cardId: CardId, playerId: string): Anchor | null => {
        const captured = launchRects.current.get(cardId);
        if (captured) {
          launchRects.current.delete(cardId);
          return captured;
        }
        if (playerId === current?.youId) return readAnchor(anchorKeys.hand);
        return readAnchor(anchorKeys.seat(playerId));
      };

      const fly = (options: {
        key: string;
        card: RamiCard | null;
        from: Anchor;
        to: Anchor;
        toWidth: number;
        delay?: number;
        track?: CardId;
        duration?: number;
      }) => {
        const id = `${options.key}`;
        if (options.track) flightCards.current.set(id, options.track);
        const travel = Math.hypot(options.to.x - options.from.x, options.to.y - options.from.y);
        created.push({
          id,
          card: options.card,
          fromX: options.from.x,
          fromY: options.from.y,
          fromWidth: options.from.width || handCardWidth,
          toX: options.to.x,
          toY: options.to.y,
          toWidth: options.toWidth,
          rotateFrom: (Math.random() - 0.5) * 22,
          rotateTo: (Math.random() - 0.5) * 8,
          delay: options.delay ?? 0,
          duration: options.duration ?? FLIGHT_DURATION,
          arc: Math.min(150, 48 + travel * 0.17),
          bounce: true,
        });
      };

      for (const { seq, event } of fresh) {
        switch (event.type) {
          case 'round_start': {
            setDealToken((token) => token + 1);
            setPendingCardIds(new Set());
            setFreshCardIds(new Set());
            const stock = readAnchor(anchorKeys.stock);
            setHandOrigin({ dx: 0, dy: 110 });
            if (!stock || reducedMotion || !current) break;

            const total = Object.values(event.perPlayer).reduce((a, b) => a + b, 0);
            const step = Math.min(0.045, 2.3 / Math.max(total, 1));
            const maxCards = Math.max(...Object.values(event.perPlayer));
            let index = 0;

            for (let round = 0; round < maxCards; round++) {
              for (const player of current.players) {
                if ((event.perPlayer[player.id] ?? 0) <= round) continue;
                index++;
                if (player.id === current.youId) continue;
                const seat = readAnchor(anchorKeys.seat(player.id));
                if (!seat) continue;
                created.push({
                  id: `deal:${seq}:${player.id}:${round}`,
                  card: null,
                  fromX: stock.x,
                  fromY: stock.y,
                  fromWidth: tableCardWidth * 0.55,
                  toX: seat.x,
                  toY: seat.y,
                  toWidth: tableCardWidth * 0.42,
                  rotateFrom: 0,
                  rotateTo: (Math.random() - 0.5) * 36,
                  delay: index * step,
                  duration: 0.4,
                  arc: 38,
                  bounce: false,
                });
                if (index % 3 === 0) sound().play('deal', { delay: index * step });
              }
            }
            break;
          }

          case 'draw': {
            const mine = event.playerId === current?.youId;
            const fromKey = event.from === 'stock' ? anchorKeys.stock : anchorKeys.discard;
            const from = readAnchor(fromKey);
            const hand = readAnchor(anchorKeys.hand);

            if (mine) {
              // La carte entre dans la main : l'animation d'arrivée de
              // l'éventail part du bon endroit, inutile de la doubler d'un vol.
              if (from && hand) {
                setHandOrigin({ dx: from.x - hand.x, dy: from.y - hand.y });
              }
              sound().play(event.from === 'stock' ? 'deal' : 'flick');
              break;
            }

            const seat = readAnchor(anchorKeys.seat(event.playerId));
            if (!from || !seat || reducedMotion) break;
            fly({
              key: `draw:${seq}`,
              card: event.from === 'discard' ? event.card : null,
              from,
              to: seat,
              toWidth: tableCardWidth * 0.5,
              duration: 0.46,
            });
            sound().play('deal');
            break;
          }

          case 'take_cancelled': {
            if (event.playerId === current?.youId) {
              pushNotice('Carte remise sur la défausse', 'neutral');
            }
            sound().play('deselect');
            break;
          }

          case 'meld_laid': {
            const actor = current?.players.find((player) => player.id === event.playerId);
            if (event.isOpening) {
              setOpeningMoment({ playerId: event.playerId, points: event.points, token: seq });
              pushNotice(
                `${actor?.name ?? 'Un joueur'} ouvre à ${event.points} points`,
                'good',
              );
              haptic('success');
              sound().play('carre');
            } else {
              pushNotice(`${actor?.name ?? 'Un joueur'} pose ${event.points} points`, 'neutral');
              sound().play('land');
            }
            // Les combinaisons neuves entrent avec l'animation du tapis :
            // aucun vol, sans quoi les cartes seraient visibles deux fois.
            break;
          }

          case 'meld_extended': {
            const to = readAnchor(anchorKeys.meld(event.meldId));
            if (!to || reducedMotion) {
              setPendingCardIds((set) => {
                const next = new Set(set);
                for (const card of event.cards) next.delete(card.id);
                return next;
              });
              sound().play('land');
              break;
            }
            event.cards.forEach((card, index) => {
              const from = sourceFor(card.id, event.playerId) ?? to;
              fly({
                key: `ext:${seq}:${card.id}`,
                card,
                from,
                to,
                toWidth: tableCardWidth,
                delay: index * 0.07,
                track: card.id,
              });
              sound().play('flick', { delay: index * 0.07 });
            });
            break;
          }

          case 'joker_reclaimed': {
            const meld = readAnchor(anchorKeys.meld(event.meldId));
            const target =
              event.playerId === current?.youId
                ? readAnchor(anchorKeys.hand)
                : readAnchor(anchorKeys.seat(event.playerId));
            const actor = current?.players.find((player) => player.id === event.playerId);

            pushNotice(
              event.fromOpponent
                ? `${actor?.name ?? 'Un joueur'} récupère un joker adverse`
                : `${actor?.name ?? 'Un joueur'} récupère un joker`,
              'good',
            );
            haptic('success');
            sound().play('carre');

            if (meld && !reducedMotion) {
              event.replacedBy.forEach((card, index) => {
                const from = sourceFor(card.id, event.playerId) ?? meld;
                fly({
                  key: `rec:${seq}:${card.id}`,
                  card,
                  from,
                  to: meld,
                  toWidth: tableCardWidth,
                  delay: index * 0.08,
                  track: card.id,
                });
              });
              if (target) {
                fly({
                  key: `joker:${seq}`,
                  card: event.joker,
                  from: meld,
                  to: target,
                  toWidth: tableCardWidth,
                  delay: 0.24,
                  duration: 0.6,
                });
              }
            } else {
              setPendingCardIds((set) => {
                const next = new Set(set);
                for (const card of event.replacedBy) next.delete(card.id);
                return next;
              });
            }
            break;
          }

          case 'discard': {
            const to = readAnchor(anchorKeys.discard);
            if (!to || reducedMotion) {
              setPendingCardIds((set) => {
                const next = new Set(set);
                next.delete(event.card.id);
                return next;
              });
              sound().play('land');
              break;
            }
            const from = sourceFor(event.card.id, event.playerId) ?? to;
            fly({
              key: `disc:${seq}`,
              card: event.card,
              from,
              to,
              toWidth: tableCardWidth,
              track: event.card.id,
              duration: 0.5,
            });
            sound().play('flick');
            sound().play('land', { delay: 0.44 });
            break;
          }

          case 'recycle':
            pushNotice(
              `Pioche épuisée — ${event.count} cartes remélangées`,
              'neutral',
            );
            sound().play('deal');
            break;

          case 'turn':
            if (event.playerId === current?.youId) {
              sound().play('turn');
              haptic('tap');
            }
            break;

          case 'timeout':
            if (event.playerId === current?.youId) {
              pushNotice('Temps écoulé — tour joué automatiquement', 'warn');
            }
            break;

          case 'round_end': {
            const winner = current?.players.find(
              (player) => player.id === event.summary.winnerId,
            );
            pushNotice(
              winner ? `${winner.name} termine la manche` : 'Manche terminée',
              'good',
            );
            sound().play('victory');
            break;
          }

          case 'game_over': {
            pushNotice(`Partie terminée en ${MODE_LABELS[current?.settings.mode ?? '1v1']}`, 'good');
            sound().play('victory');
            break;
          }

          default:
            break;
        }
      }

      if (created.length > 0) {
        setFlights((currentFlights) => [...currentFlights, ...created]);
      }
      consumeEvents(consumeTo);
    });
  }, [
    events,
    consumeEvents,
    readAnchor,
    reducedMotion,
    tableCardWidth,
    handCardWidth,
    pushNotice,
  ]);

  // Filet de sécurité : un onglet en arrière-plan ne termine pas ses animations.
  // Sans cela, une carte resterait invisible sur le tapis indéfiniment.
  useEffect(() => {
    if (pendingCardIds.size === 0) return;
    const timer = setTimeout(() => setPendingCardIds(new Set()), 2600);
    return () => clearTimeout(timer);
  }, [pendingCardIds]);

  // Une carte reprise dans la défausse mérite un rappel explicite.
  const lastWarned = useRef<string | null>(null);
  useEffect(() => {
    if (!view?.hints.mustUseTakenCard) {
      lastWarned.current = null;
      return;
    }
    const taken = view.hand.find((card) => card.id === view.turn?.takenCardId);
    if (!taken || lastWarned.current === taken.id) return;
    lastWarned.current = taken.id;
    pushNotice(`Le ${shortLabel(taken)} doit servir ce tour-ci`, 'warn');
  }, [view, pushNotice]);

  return {
    flights,
    onLanded,
    notices,
    pushNotice,
    pendingCardIds,
    freshCardIds,
    dealToken,
    handOrigin,
    captureCards,
    openingMoment,
  };
}
