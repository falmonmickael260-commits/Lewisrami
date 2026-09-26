'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { comboLabel } from '@/game/cards';
import { canBeat, getCombo } from '@/game/rules';
import type { Card } from '@/game/types';
import type { PlayerView } from '@/game/view';
import { QUEEN_OF_SPADES } from '@/game/cards';
import { useDirector } from '@/hooks/useDirector';
import type { RoomHandle } from '@/hooks/useRoom';
import { sound } from '@/lib/sound';
import { anchorKeys, useAnchors } from './Anchors';
import { ActionBar } from './ActionBar';
import { CarreOverlay } from './CarreOverlay';
import { CenterPile } from './CenterPile';
import { FlightLayer } from './FlightLayer';
import { HandFan } from './HandFan';
import { Notices } from './Notices';
import { PlayerSeat } from './PlayerSeat';
import { RoundResults } from './RoundResults';
import { RulesSheet } from './RulesSheet';
import { TopBar } from './TopBar';
import { TurnTimer } from './TurnTimer';
import { ROLE_META } from './roles';

const PHASE_LABELS: Record<PlayerView['phase'], string> = {
  lobby: 'Salon',
  dealing: 'Distribution',
  exchange: 'Échange des cartes',
  playing: 'En jeu',
  round_end: 'Fin de manche',
  game_over: 'Partie terminée',
};

/**
 * Répartit les adversaires sur une ellipse, le joueur local occupant le bas.
 * Les positions sont calculées en pixels à partir de la taille mesurée, ce qui
 * garantit qu'aucun siège ne déborde de la table, même à 8 joueurs sur mobile.
 */
const ARENA_CENTER_Y = 0.45;
/** Au-delà, les sièges s'éloigneraient trop du pli sur très grand écran. */
const MAX_SEAT_RX = 520;
const MAX_SEAT_RY = 250;

function seatPosition(
  index: number,
  total: number,
  size: { width: number; height: number },
  seatHalfWidth: number,
  seatHalfHeight: number,
) {
  const angle = (90 + ((index + 1) * 360) / total) * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerY = size.height * ARENA_CENTER_Y;
  const rx = Math.max(40, Math.min(size.width / 2 - seatHalfWidth - 4, MAX_SEAT_RX));
  const ry = Math.max(
    30,
    Math.min(
      centerY - seatHalfHeight - 6,
      size.height - centerY - seatHalfHeight - 6,
      size.width * 0.44,
      MAX_SEAT_RY,
    ),
  );
  return {
    left: size.width / 2 + cos * rx,
    top: centerY + sin * ry,
  };
}

export function GameTable({
  room,
  code,
  onLeave,
}: {
  room: RoomHandle;
  code: string;
  onLeave: () => void;
}) {
  const view = room.view;
  const { read } = useAnchors();
  const prefersReduced = useReducedMotion();
  const reducedMotion = prefersReduced ?? false;

  const tableRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [dealOrigin, setDealOrigin] = useState({ dx: 0, dy: -200 });

  useEffect(() => setSoundOn(sound().isEnabled()), []);

  useEffect(() => {
    const element = tableRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  const compact = size.width > 0 && size.width < 640;
  const pileCardWidth = useMemo(() => {
    if (size.width === 0) return 76;
    const byWidth = compact ? size.width * 0.175 : size.width * 0.082;
    const byHeight = size.height * 0.2;
    return Math.round(Math.max(48, Math.min(compact ? 78 : 112, Math.min(byWidth, byHeight))));
  }, [size, compact]);

  const director = useDirector({
    view,
    events: room.events,
    consumeEvents: room.consumeEvents,
    readAnchor: read,
    reducedMotion,
    pileCardWidth,
    handCardWidth: pileCardWidth,
  });

  // Point de départ de la distribution : du centre de la table vers la main.
  useEffect(() => {
    const deck = read(anchorKeys.deck);
    const hand = read(anchorKeys.hand);
    if (deck && hand) setDealOrigin({ dx: deck.x - hand.x, dy: deck.y - hand.y });
  }, [read, size.width, size.height, director.dealToken]);

  const me = view?.players.find((p) => p.id === view.youId) ?? null;
  const currentPlayer = view?.players.find((p) => p.id === view.currentPlayerId) ?? null;
  const isYourTurn = Boolean(view && view.youId && view.currentPlayerId === view.youId);

  // Une sélection ne survit jamais à un changement de tour ou de phase.
  useEffect(() => {
    setSelected([]);
  }, [view?.currentPlayerId, view?.phase, view?.roundNumber]);

  const hand = view?.hand ?? [];
  const handById = useMemo(() => new Map(hand.map((c) => [c.id, c])), [hand]);

  const pendingTransfer = useMemo(
    () =>
      view?.exchange?.transfers.find(
        (t) => t.fromId === view.youId && t.mode === 'choice' && !t.done,
      ) ?? null,
    [view],
  );

  const exchangeMode = view?.phase === 'exchange' && pendingTransfer !== null;

  const toggleCard = useCallback(
    (cardId: string) => {
      const card = handById.get(cardId);
      if (!card) return;
      setSelected((current) => {
        if (current.includes(cardId)) {
          sound().play('deselect');
          return current.filter((id) => id !== cardId);
        }
        sound().play('select');

        if (exchangeMode && pendingTransfer) {
          if (current.length >= pendingTransfer.count) {
            return [...current.slice(1), cardId];
          }
          return [...current, cardId];
        }

        // Hors échange, une combinaison ne mélange jamais deux valeurs :
        // choisir une autre valeur repart d'une sélection propre.
        const first = current[0] ? handById.get(current[0]) : undefined;
        if (first && first.rank !== card.rank) return [cardId];
        if (current.length >= 4) return current;
        return [...current, cardId];
      });
    },
    [handById, exchangeMode, pendingTransfer],
  );

  const selectedCards = useMemo(
    () => selected.map((id) => handById.get(id)).filter((c): c is Card => Boolean(c)),
    [selected, handById],
  );

  const tableTop = useMemo(() => {
    if (!view || view.requiredCount === null || view.pile.length === 0) return null;
    return { rank: view.pile[view.pile.length - 1].rank, count: view.requiredCount };
  }, [view]);

  const mustPlayQueen = Boolean(
    view?.mustOpenWithQueenOfSpades && view.pile.length === 0 && isYourTurn,
  );

  const selectionCheck = useMemo(() => {
    if (!view) return { valid: false, text: null as string | null };
    if (exchangeMode && pendingTransfer) {
      const need = pendingTransfer.count;
      if (selected.length === 0) {
        return { valid: false, text: `Choisissez ${need} carte${need > 1 ? 's' : ''} à donner` };
      }
      return {
        valid: selected.length === need,
        text:
          selected.length === need
            ? `${need} carte${need > 1 ? 's' : ''} prête${need > 1 ? 's' : ''} à donner`
            : `Encore ${need - selected.length} carte${need - selected.length > 1 ? 's' : ''}`,
      };
    }
    if (selectedCards.length === 0) return { valid: false, text: null };

    const combo = getCombo(selectedCards);
    if (!combo) return { valid: false, text: 'Les cartes doivent être de même valeur' };
    if (tableTop && combo.count !== tableTop.count) {
      return {
        valid: false,
        text: `Il faut poser ${tableTop.count} carte${tableTop.count > 1 ? 's' : ''}`,
      };
    }
    if (!canBeat(combo, tableTop, view.settings.allowEqualRank)) {
      return { valid: false, text: `Trop faible face à ${comboLabel(tableTop!.rank, tableTop!.count)}` };
    }
    if (mustPlayQueen && !selected.includes(QUEEN_OF_SPADES)) {
      return { valid: false, text: 'La Dame de pique doit ouvrir la partie' };
    }
    return { valid: true, text: `${comboLabel(combo.rank, combo.count)} — prêt` };
  }, [view, exchangeMode, pendingTransfer, selected, selectedCards, tableTop, mustPlayQueen]);

  const playSelected = useCallback(async () => {
    if (!view || selected.length === 0) return;
    for (const id of selected) {
      const anchor = read(anchorKeys.card(id));
      if (anchor) director.noteLaunch(id, anchor);
    }
    const ids = [...selected];
    setSelected([]);
    const ok = await room.send(exchangeMode ? 'exchange_give' : 'play', { cardIds: ids });
    if (!ok) {
      sound().play('error');
      setSelected(ids);
    }
  }, [view, selected, read, director, room, exchangeMode]);

  const passTurn = useCallback(async () => {
    setSelected([]);
    const ok = await room.send('pass');
    if (!ok) sound().play('error');
  }, [room]);

  const toggleSound = useCallback(() => {
    const next = !sound().isEnabled();
    sound().setEnabled(next);
    setSoundOn(next);
    if (next) sound().play('select');
  }, []);

  /* Raccourcis clavier : le jeu reste jouable sans souris. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'Enter' && selectionCheck.valid) {
        event.preventDefault();
        void playSelected();
      }
      if ((event.key === 'p' || event.key === 'P') && isYourTurn && view?.pile.length) {
        event.preventDefault();
        void passTurn();
      }
      if (event.key === 'Escape') setSelected([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectionCheck.valid, playSelected, passTurn, isYourTurn, view?.pile.length]);

  if (!view) return null;

  const opponents = (() => {
    const ordered = view.players.slice().sort((a, b) => a.seat - b.seat);
    if (!view.youId) return ordered;
    const myIndex = ordered.findIndex((p) => p.id === view.youId);
    if (myIndex === -1) return ordered;
    return [...ordered.slice(myIndex + 1), ...ordered.slice(0, myIndex)];
  })();

  // Au-delà de 5 joueurs sur écran étroit, l'ellipse ne tient plus :
  // les adversaires passent alors dans un bandeau supérieur.
  const ringLayout = !compact || view.players.length <= 5;
  const opponentRows = Math.ceil(opponents.length / 4);
  const stripHeight = opponentRows * 92;
  const pileTopPercent =
    size.height > 0
      ? Math.min(76, ((stripHeight + (size.height - stripHeight) * 0.44) / size.height) * 100)
      : 60;

  const statusText = (() => {
    if (view.phase === 'dealing') return 'Distribution des cartes…';
    if (view.phase === 'exchange') {
      if (pendingTransfer) {
        const target = view.players.find((p) => p.id === pendingTransfer.toId);
        return `Donnez ${pendingTransfer.count} carte${pendingTransfer.count > 1 ? 's' : ''} à ${target?.name ?? 'votre adversaire'}`;
      }
      return 'Échange des cartes en cours…';
    }
    if (view.phase !== 'playing') return PHASE_LABELS[view.phase];
    if (me?.finishPosition !== null && me?.finishPosition !== undefined) {
      return 'Vous avez terminé — la manche continue';
    }
    if (isYourTurn) {
      if (mustPlayQueen) return 'À vous — posez la Dame de pique';
      if (!tableTop) return 'À vous — repartez comme vous voulez';
      return 'À vous de jouer';
    }
    return `Au tour de ${currentPlayer?.name ?? '…'}`;
  })();

  const canPlay =
    selectionCheck.valid &&
    (exchangeMode || (isYourTurn && view.phase === 'playing'));
  const canPass = isYourTurn && view.phase === 'playing' && view.pile.length > 0;

  return (
    <div className="felt-surface felt-grain relative flex h-dvh w-full flex-col overflow-hidden">
      <TopBar
        code={code}
        roundNumber={view.roundNumber}
        rounds={view.settings.rounds}
        phaseLabel={PHASE_LABELS[view.phase]}
        status={room.status}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onOpenRules={() => setRulesOpen(true)}
        onLeave={onLeave}
      />

      {/* ----------------------------- Table ----------------------------- */}
      <div ref={tableRef} className="relative min-h-0 flex-1">
        {/* Ovale de jeu : profondeur et lumière rasante. */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
          style={{
            top: `${ARENA_CENTER_Y * 100}%`,
            width: '104%',
            height: '86%',
            background:
              'radial-gradient(ellipse at 50% 36%, rgba(255,255,255,0.07), rgba(255,255,255,0.018) 48%, transparent 72%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -40px 80px rgba(0,0,0,0.4), 0 50px 130px -50px rgba(0,0,0,0.95)',
          }}
        />

        {/* Bord proche : le tapis se prolonge vers le joueur au lieu de s'arrêter net. */}
        <div
          className="pointer-events-none absolute inset-x-[-8%] bottom-[-26%] h-[52%] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(17,96,69,0.5), rgba(10,58,42,0.22) 46%, transparent 72%)',
          }}
        />

        {/* Halo sur la zone d'accueil : l'œil est guidé vers le centre du pli. */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
          style={{
            top: `${ARENA_CENTER_Y * 100}%`,
            width: '62%',
            height: '46%',
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.07), transparent 70%)',
          }}
        />

        {ringLayout ? (
          opponents.map((player, index) => {
            const position = seatPosition(
              index,
              view.players.length,
              size,
              compact ? 52 : 66,
              compact ? 66 : 78,
            );
            return (
              <div
                key={player.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: position.left, top: position.top }}
              >
                <PlayerSeat
                  player={player}
                  isCurrent={view.currentPlayerId === player.id}
                  isYou={false}
                  hasLead={view.lastPlayerId === player.id}
                  deadline={view.currentPlayerId === player.id ? view.turnDeadline : null}
                  totalMs={view.settings.turnSeconds * 1000}
                  skew={room.clockSkew}
                  compact={compact}
                />
              </div>
            );
          })
        ) : (
          /* Table nombreuse sur écran étroit : un bandeau évite tout chevauchement. */
          <div className="absolute inset-x-0 top-0 flex flex-wrap justify-center gap-x-1 gap-y-1.5 px-1.5 pt-1">
            {opponents.map((player) => (
              <PlayerSeat
                key={player.id}
                player={player}
                isCurrent={view.currentPlayerId === player.id}
                isYou={false}
                hasLead={view.lastPlayerId === player.id}
                deadline={view.currentPlayerId === player.id ? view.turnDeadline : null}
                totalMs={view.settings.turnSeconds * 1000}
                skew={room.clockSkew}
                compact
                dense
              />
            ))}
          </div>
        )}

        <AnimatePresence>
          {view.phase === 'playing' && tableTop && (
            <motion.div
              key={`${tableTop.rank}-${tableTop.count}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-ink-950/55 px-3 py-1 backdrop-blur-sm"
              style={{
                top: `calc(${
                  ringLayout ? ARENA_CENTER_Y * 100 : pileTopPercent
                }% + ${pileCardWidth * 1.05}px)`,
              }}
            >
              <span className="text-[0.66rem] uppercase tracking-[0.14em] text-cream/55">
                À battre · {comboLabel(tableTop.rank, tableTop.count)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --------------------------- Barre d'action --------------------------- */}
      <div className="relative z-20 shrink-0 py-1.5">
        <ActionBar
          isYourTurn={isYourTurn || exchangeMode}
          statusText={statusText}
          selectionText={selectionCheck.text}
          selectionValid={selectionCheck.valid}
          primaryLabel={exchangeMode ? 'Donner' : 'Jouer'}
          canPlay={canPlay}
          canPass={canPass}
          onPlay={playSelected}
          onPass={passTurn}
          onClear={() => setSelected([])}
          hasSelection={selected.length > 0}
          badge={<MySeatBadge view={view} skew={room.clockSkew} isYourTurn={isYourTurn} />}
        />
      </div>

      {/* ------------------------------- Main ------------------------------- */}
      <div className="pb-safe relative z-10 shrink-0 px-1">
        <HandFan
          cards={hand}
          selectedIds={selected}
          playableIds={exchangeMode ? hand.map((c) => c.id) : view.playableCardIds}
          onToggle={toggleCard}
          width={Math.min(size.width || 360, 1080)}
          compact={compact}
          interactive={
            (view.phase === 'playing' && isYourTurn) || exchangeMode
          }
          dealToken={director.dealToken}
          dealOrigin={dealOrigin}
          reducedMotion={reducedMotion}
        />
      </div>

      <FlightLayer
        flights={director.flights}
        onLanded={director.onLanded}
        reducedMotion={reducedMotion}
      />
      <Notices notices={director.notices} />
      <CarreOverlay
        moment={director.carre}
        playerName={
          view.players.find((p) => p.id === director.carre?.playerId)?.name ?? 'Un joueur'
        }
        reducedMotion={reducedMotion}
      />
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {(view.phase === 'round_end' || view.phase === 'game_over') && (
        <RoundResults
          view={view}
          isHost={Boolean(me?.isHost)}
          onNextRound={() => void room.send('next_round')}
          onRestart={() => void room.send('restart')}
          skew={room.clockSkew}
          reducedMotion={reducedMotion}
        />
      )}

      {room.status === 'reconnecting' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center pb-2">
          <span className="rounded-full border border-amber-300/30 bg-ink-950/90 px-4 py-1.5 text-[0.72rem] font-semibold text-amber-200 backdrop-blur">
            Reconnexion en cours…
          </span>
        </div>
      )}
    </div>
  );
}

/** Pastille du joueur local : rôle, chrono et repère « vous avez la main ». */
function MySeatBadge({
  view,
  skew,
  isYourTurn,
}: {
  view: PlayerView;
  skew: number;
  isYourTurn: boolean;
}) {
  const { bind } = useAnchors();
  const me = view.players.find((p) => p.id === view.youId);
  if (!me) return null;
  const role = me.role ? ROLE_META[me.role] : null;

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: 58, height: 58 }}>
      <div
        ref={bind(anchorKeys.seat(me.id))}
        className={`grid h-[46px] w-[46px] place-items-center rounded-full border text-xl ${
          isYourTurn ? 'border-gold-400/70' : 'border-white/12'
        } bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.14),rgba(6,32,24,0.9))]`}
        title={role ? role.label : 'Vous'}
      >
        <span className="no-select">{me.avatar}</span>
      </div>
      {isYourTurn && view.turnDeadline !== null && (
        <TurnTimer
          deadline={view.turnDeadline}
          totalMs={view.settings.turnSeconds * 1000}
          skew={skew}
          size={58}
          alert
        />
      )}
      {role && role.label !== 'Neutre' && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/90 px-1.5 text-[0.6rem]">
          {role.icon}
        </span>
      )}
    </div>
  );
}
