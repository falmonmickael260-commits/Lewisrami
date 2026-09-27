'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { extendMeldWith } from '@/rami/melds';
import type { Meld, RamiEvent } from '@/rami/types';
import type { RamiPlayerView } from '@/rami/view';
import { anchorKeys, useAnchors } from '@/components/game/Anchors';
import { FlightLayer } from '@/components/game/FlightLayer';
import { ramiFlightCard } from '@/components/card/flightRenderers';
import { useRamiDirector } from '@/hooks/useRamiDirector';
import { useRamiTurn } from '@/hooks/useRamiTurn';
import { useHandOrder } from '@/hooks/useHandOrder';
import type { GameRoomHandle } from '@/hooks/useGameRoom';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { haptic } from '@/lib/haptics';
import { sound } from '@/lib/sound';
import { MeldsBoard } from './MeldsBoard';
import { Piles } from './Piles';
import { RamiActionBar } from './RamiActionBar';
import { RamiHandFan } from './RamiHandFan';
import { RamiSeat } from './RamiSeat';
import { RamiTopBar } from './RamiTopBar';
import { RamiNotices } from './RamiNotices';
import { StagingTray } from './StagingTray';
import { RamiRulesSheet } from './RamiRulesSheet';
import { RoundSummarySheet } from './RoundSummarySheet';
import { GameOverSheet } from './GameOverSheet';
import { buildRamiStatus } from './status';

export type RamiRoom = GameRoomHandle<RamiPlayerView, RamiEvent>;

/** Référence stable : évite de retrier la main à chaque rendu avant la vue. */
const EMPTY_HAND: RamiPlayerView['hand'] = [];

/** En dessous, l'écran est trop bas pour une mise en page confortable. */
const SHORT_SCREEN = 540;

/**
 * Largeur d'une carte de combinaison.
 *
 * Elle suit la largeur disponible, mais un écran **bas** — un téléphone tenu en
 * paysage — doit aussi rétrécir, sinon le tapis ne tient plus entre les sièges
 * et la main.
 */
function meldCardWidth(size: { width: number; height: number }, laidCount: number): number {
  let base: number;
  if (size.width === 0) base = 50;
  else if (size.height < SHORT_SCREEN) base = 38;
  else if (size.width < 400) base = 40;
  else if (size.width < 640) base = 46;
  else if (size.width < 900) base = 54;
  else if (size.width < 1280) base = 60;
  else base = 68;

  // À plusieurs joueurs, le tapis peut vite compter 20-30 cartes posées : sans
  // ça, tout ne tient plus à l'écran et il faut faire défiler pour voir les
  // combinaisons des autres — l'objectif est justement de toutes les voir
  // d'un coup.
  if (laidCount > 28) return Math.round(base * 0.62);
  if (laidCount > 20) return Math.round(base * 0.74);
  if (laidCount > 12) return Math.round(base * 0.86);
  return base;
}

function pileCardWidth(size: { width: number; height: number }): number {
  if (size.width === 0) return 64;
  if (size.height < SHORT_SCREEN) return 46;
  if (size.width < 400) return 56;
  if (size.width < 640) return 64;
  if (size.width < 900) return 74;
  return 86;
}

/**
 * Largeur maximale d'une carte en main.
 *
 * L'éventail se dimensionne d'abord sur la largeur ; sans ce plafond, une main
 * de quinze cartes mangerait plus de la moitié d'un écran de 390 px de haut.
 */
function handMaxCard(size: { width: number; height: number }, compact: boolean): number {
  const base = compact ? 126 : 136;
  if (size.height === 0) return base;
  // Sur un écran bas, la main doit laisser vivre le tapis : on plafonne plus tôt.
  const factor = size.height < 460 ? 0.19 : 0.25;
  return Math.max(50, Math.min(base, Math.round(size.height * factor)));
}

/**
 * Table de Rami.
 *
 * Elle n'applique **aucune règle** : elle affiche la vue envoyée par le serveur,
 * anime ce qui vient de se produire, et transmet les intentions du joueur. Tout
 * ce qui est autorisé ou refusé l'est par le moteur.
 */
export function RamiTable({
  room,
  code,
  onLeave,
}: {
  room: RamiRoom;
  code: string;
  onLeave: () => void;
}) {
  const view = room.view;
  const { read } = useAnchors();
  const reducedMotion = useReducedMotion() ?? false;

  const tableRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => setSoundOn(sound().isEnabled()), []);

  useLayoutEffect(() => {
    const element = tableRef.current;
    if (!element) return;
    const measure = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  const short = size.height > 0 && size.height < SHORT_SCREEN;
  const compact = size.width > 0 && (size.width < 700 || short);
  const laidCardCount = useMemo(
    () => view?.melds.reduce((sum, meld) => sum + meld.slots.length, 0) ?? 0,
    [view?.melds],
  );
  const tableCardWidth = useMemo(
    () => meldCardWidth(size, laidCardCount),
    [size, laidCardCount],
  );
  const pileWidth = useMemo(() => pileCardWidth(size), [size]);
  const handWidth = useMemo(() => handMaxCard(size, compact), [size, compact]);

  const isMyTurn = Boolean(view && view.currentPlayerId === view.youId);
  const turn = useRamiTurn(view, isMyTurn);
  const hand = useHandOrder(view?.hand ?? EMPTY_HAND);

  const director = useRamiDirector({
    view,
    events: room.events,
    consumeEvents: room.consumeEvents,
    readAnchor: read,
    reducedMotion,
    tableCardWidth,
    handCardWidth: pileWidth,
  });

  const { pushNotice } = director;

  // Un refus du serveur n'est jamais un message technique : on le montre tel
  // quel, puisque le moteur écrit déjà en français.
  useEffect(() => {
    if (!room.error) return;
    pushNotice(room.error, 'warn');
    room.clearError();
  }, [room, pushNotice]);

  // L'écran de fin de manche s'ouvre dès que le décompte arrive.
  useEffect(() => {
    if (view?.phase === 'round_end') setSummaryOpen(true);
    if (view?.phase === 'playing') setSummaryOpen(false);
  }, [view?.phase, view?.roundNumber]);

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  /** Protège contre les doubles actions : un envoi à la fois. */
  const guarded = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      if (busy) return false;
      setBusy(true);
      try {
        return await room.send(action, payload);
      } finally {
        setBusy(false);
      }
    },
    [busy, room],
  );

  const onDrawStock = useCallback(() => void guarded('draw_stock'), [guarded]);
  const onTakeDiscard = useCallback(() => void guarded('take_discard'), [guarded]);
  const onCancelTake = useCallback(() => void guarded('cancel_take'), [guarded]);

  const onLay = useCallback(() => {
    const ids = turn.proposals.flatMap((proposal) => proposal.cardIds);
    director.captureCards(ids);
    void guarded('lay_melds', { melds: turn.proposals }).then((ok) => {
      if (ok) turn.clearGroups();
    });
  }, [turn, director, guarded]);

  const onDiscard = useCallback(() => {
    const cardId = turn.selected[0];
    if (!cardId) return;
    director.captureCards([cardId]);
    void guarded('discard', { cardId }).then((ok) => {
      if (ok) turn.clearSelection();
    });
  }, [turn, director, guarded]);

  // Rami : toute la main tient en combinaisons valides. On pose les groupes
  // ensemble puis on jette automatiquement l'unique carte restante — les deux
  // actions existantes (`lay_melds`, `discard`), enchaînées, rien d'autre.
  const onRami = useCallback(() => {
    const suggestion = turn.suggestion;
    if (!suggestion || !suggestion.emptiesHand) return;
    const leftover = suggestion.leftoverCardId;
    const ids = suggestion.melds.flatMap((meld) => meld.cardIds);
    director.captureCards(ids);
    void guarded('lay_melds', { melds: suggestion.melds }).then((ok) => {
      if (!ok || !leftover) return;
      director.captureCards([leftover]);
      void guarded('discard', { cardId: leftover });
    });
  }, [turn.suggestion, director, guarded]);

  const ramiAnnounced = useRef(false);
  useEffect(() => {
    const isRami = Boolean(turn.suggestion?.emptiesHand);
    if (isRami && !ramiAnnounced.current) {
      ramiAnnounced.current = true;
      director.pushNotice('🏆 RAMI ! Toute votre main peut être posée', 'good');
      haptic('success');
      sound().play('carre');
    } else if (!isRami) {
      ramiAnnounced.current = false;
    }
  }, [turn.suggestion, director]);

  const onMeldActivate = useCallback(
    (meld: Meld) => {
      const affordance = turn.affordanceFor(meld);
      if (affordance === 'reclaim') {
        const cardIds = turn.reclaimFor(meld.id);
        if (!cardIds) return;
        director.captureCards(cardIds);
        void guarded('reclaim_joker', { meldId: meld.id, cardIds });
        return;
      }
      if (affordance === 'extend') {
        const cardIds = turn.selected.slice();
        director.captureCards(cardIds);
        void guarded('extend_meld', { meldId: meld.id, cardIds }).then((ok) => {
          if (ok) turn.clearSelection();
        });
      }
    },
    [turn, director, guarded],
  );

  /**
   * Carte lâchée sur la table.
   *
   * Le geste est une commodité : il ne crée aucun droit. La même carte lâchée
   * sur la défausse ou sur une combinaison passe par les mêmes actions — et
   * donc par la même validation serveur — que les boutons.
   */
  const onDropCard = useCallback(
    (cardId: string, point: { x: number; y: number }): boolean => {
      const current = room.view;
      if (!current || current.phase !== 'playing') return false;
      if (current.currentPlayerId !== current.youId) return false;
      if (current.turn?.stage !== 'meld') return false;

      const hits = (key: string, slack = 18) => {
        const anchor = read(key);
        if (!anchor) return false;
        return (
          Math.abs(point.x - anchor.x) <= anchor.width / 2 + slack &&
          Math.abs(point.y - anchor.y) <= anchor.height / 2 + slack
        );
      };

      // Lâchée sur la défausse : le tour se termine.
      if (hits(anchorKeys.discard)) {
        if (current.hints.mustUseTakenCard || turn.groups.length > 0) return true;
        director.captureCards([cardId]);
        void guarded('discard', { cardId }).then((ok) => {
          if (ok) turn.clearSelection();
        });
        return true;
      }

      // Lâchée sur une combinaison : complément, si elle l'accepte.
      for (const meld of current.melds) {
        if (!hits(anchorKeys.meld(meld.id), 8)) continue;
        const card = current.hand.find((entry) => entry.id === cardId);
        if (!card) return true;
        if (turn.affordanceFor(meld) === 'none') return true;
        if (!extendMeldWith(meld, [card]).ok) {
          director.pushNotice(
            'Cette carte ne complète pas cette combinaison.',
            'warn',
          );
          return true;
        }
        director.captureCards([cardId]);
        void guarded('extend_meld', { meldId: meld.id, cardIds: [cardId] }).then((ok) => {
          if (ok) turn.clearSelection();
        });
        return true;
      }

      return false;
    },
    [room.view, read, turn, director, guarded],
  );

  const onNextRound = useCallback(() => void guarded('next_round'), [guarded]);
  const onRestart = useCallback(() => void guarded('restart'), [guarded]);

  /* ---------------------------------------------------------------- */
  /* Clavier                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Raccourcis de bureau.
   *
   * Ils ne font rien de plus que les boutons : ils déclenchent exactement la
   * même action, et se taisent dès qu'une feuille est ouverte ou qu'on écrit
   * dans un champ.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (rulesOpen || menuOpen || summaryOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const current = room.view;
      if (!current || current.phase !== 'playing') return;
      const mine = current.currentPlayerId === current.youId;
      const stage = current.turn?.stage;

      switch (event.key) {
        case 'Escape':
          if (turn.groups.length > 0) turn.clearGroups();
          else turn.clearSelection();
          break;
        case 'p':
        case 'P':
          if (mine && stage === 'draw') {
            event.preventDefault();
            onDrawStock();
          }
          break;
        case 'r':
        case 'R':
          if (mine && stage === 'draw' && current.discardTop) {
            event.preventDefault();
            onTakeDiscard();
          }
          break;
        case 't':
        case 'T':
          event.preventDefault();
          hand.toggle();
          break;
        case 'Enter':
          if (!mine) break;
          event.preventDefault();
          if (turn.canLay) onLay();
          else if (turn.selectionHint.valid && stage === 'meld') turn.addGroup();
          else if (turn.canDiscard) onDiscard();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    room.view,
    rulesOpen,
    menuOpen,
    summaryOpen,
    turn,
    hand,
    onDrawStock,
    onTakeDiscard,
    onLay,
    onDiscard,
  ]);

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  if (!view) {
    return (
      <div className="felt-surface grid min-h-dvh place-items-center">
        <p className="text-cream/60">Connexion à la table…</p>
      </div>
    );
  }

  const me = view.players.find((player) => player.id === view.youId) ?? null;
  const others = view.players.filter((player) => player.id !== view.youId);
  // En 2v2, le partenaire va au centre et les deux adversaires de part et
  // d'autre : les équipes se font face plutôt que de dépendre de l'ordre
  // d'arrivée à la table.
  const opponents =
    view.settings.mode === '2v2' && me
      ? (() => {
          const partner = others.find((player) => player.teamId === me.teamId);
          const rivals = others.filter((player) => player.teamId !== me.teamId);
          return partner && rivals.length === 2 ? [rivals[0], partner, rivals[1]] : others;
        })()
      : others;
  const status = buildRamiStatus(view);
  const stage = view.turn?.stage ?? 'draw';
  const locked = view.phase !== 'playing';

  const renderSeat = (player: (typeof opponents)[number], dense = false) => (
    <RamiSeat
      key={player.id}
      player={player}
      mode={view.settings.mode}
      isCurrent={view.currentPlayerId === player.id}
      isDealer={view.dealerId === player.id}
      isPartner={Boolean(me && me.teamId === player.teamId)}
      deadline={view.currentPlayerId === player.id ? view.turnDeadline : null}
      totalMs={view.turnTotalMs ?? view.settings.turnSeconds * 1000}
      clockSkew={room.clockSkew}
      compact={compact}
      dense={dense}
    />
  );
  // 2v2 en croix (portrait/desktop) : partenaire au-dessus, adversaires de
  // chaque côté de la table — sur écran bas, la colonne compacte existante
  // suffit et reste inchangée.
  const isCross2v2 = !short && view.settings.mode === '2v2';
  const [rivalLeft, partner2v2, rivalRight] = isCross2v2 ? opponents : [null, null, null];

  const canDrawStock = isMyTurn && !locked && stage === 'draw';
  const canTakeDiscard = isMyTurn && !locked && stage === 'draw' && view.discardTop !== null;
  const canCancelTake = Boolean(
    isMyTurn && !locked && view.turn?.takenCardId && !view.turn.takenCardUsed,
  );

  const emptyHint =
    view.hints.openingLabel ??
    'Aucune combinaison posée pour l’instant. Il faut 71 points et une tierce de trois vraies cartes pour ouvrir.';

  return (
    <div
      ref={tableRef}
      className="rami-table felt-surface felt-grain relative flex h-dvh flex-col overflow-hidden"
    >
      <RamiTopBar
        view={view}
        status={room.status}
        onRules={() => setRulesOpen(true)}
        onMenu={() => setMenuOpen(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col" style={{ paddingTop: 'var(--table-top-bar)' }}>
        {/* ---------------------------------------- Adversaires + tapis */}
        {/* Sur un écran bas — un téléphone en paysage — les sièges passent en
            colonne à droite : la hauteur est la ressource rare, la largeur non. */}
        {(() => {
          const felt = (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute rounded-[2rem] border border-gold-500/10 ${
                short ? '-inset-x-2 -inset-y-1' : '-inset-x-3 -inset-y-4 sm:-inset-x-5 sm:-inset-y-6'
              }`}
              style={{
                background:
                  'radial-gradient(75% 95% at 50% 45%, rgb(255 255 255 / 0.05), transparent 72%)',
                boxShadow:
                  'inset 0 1px 0 rgb(255 255 255 / 0.05), 0 50px 110px -70px rgb(0 0 0 / 0.95)',
              }}
            />
          );
          const piles = (
            <div className="relative flex shrink-0 justify-center sm:items-center">
              <Piles
                stockCount={view.stockCount}
                discardTop={view.discardTop}
                discardCount={view.discardCount}
                cardWidth={pileWidth}
                canDrawStock={canDrawStock}
                canTakeDiscard={canTakeDiscard}
                canDropDiscard={turn.canDiscard}
                onDrawStock={onDrawStock}
                onTakeDiscard={onTakeDiscard}
                onDiscard={onDiscard}
                recycles={view.recycles}
                hiddenCardIds={director.pendingCardIds}
                compact={compact}
              />
            </div>
          );
          const board = (
            <div
              className="relative flex min-h-0 max-h-full flex-1 flex-col justify-center overflow-y-auto overflow-x-hidden py-1 pr-0.5"
              aria-label="Combinaisons posées"
            >
              <MeldsBoard
                melds={view.melds}
                players={view.players}
                mode={view.settings.mode}
                myTeamId={me?.teamId ?? null}
                cardWidth={tableCardWidth}
                compact={compact}
                affordanceFor={turn.affordanceFor}
                onActivate={onMeldActivate}
                freshCardIds={director.freshCardIds}
                hiddenCardIds={director.pendingCardIds}
                emptyHint={emptyHint}
              />
            </div>
          );

          if (isCross2v2 && partner2v2 && rivalLeft && rivalRight) {
            // Vraie disposition en croix : partenaire au-dessus de la table,
            // adversaires de chaque côté — les deux équipes se voient
            // immédiatement, sans dépendre d'un simple ordre dans une rangée.
            return (
              <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 px-2 pb-1">
                {renderSeat(partner2v2)}
                <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-2">
                  {renderSeat(rivalLeft)}
                  <div className="relative mx-auto flex max-h-full w-full max-w-3xl flex-1 items-center gap-2 sm:gap-4">
                    {felt}
                    {piles}
                    {board}
                  </div>
                  {renderSeat(rivalRight)}
                </div>
              </div>
            );
          }

          return (
            <>
              {!short && (
                <div className="flex shrink-0 flex-wrap items-start justify-center gap-1.5 px-2 pb-1">
                  {opponents.map((player) => renderSeat(player))}
                </div>
              )}
              <div className="flex min-h-0 flex-1 items-center justify-center px-2">
                <div className="relative mx-auto flex max-h-full w-full max-w-5xl flex-col gap-2 sm:flex-row sm:gap-4">
                  {felt}
                  {piles}
                  {board}
                  {short && (
                    <div
                      className={`relative flex max-h-full shrink-0 flex-col gap-1 overflow-y-auto ${
                        view.settings.mode === '2v2' ? 'justify-between' : ''
                      }`}
                    >
                      {opponents.map((player) => renderSeat(player, true))}
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()}

        {/* ------------------------------------------------------- Le bas */}
        <div className="pb-safe shrink-0 px-2 pt-1">
          <div className="mx-auto flex max-w-4xl flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {turn.groups.length > 0 && (
                <StagingTray
                  key="tray"
                  groups={turn.groups}
                  total={turn.stagedPoints}
                  required={turn.requiredPoints}
                  hasRun={turn.stagedHasRun}
                  requiresRun={view.hints.requiresOpeningRun}
                  onRemove={turn.removeGroup}
                  onClear={turn.clearGroups}
                />
              )}
            </AnimatePresence>

            <RamiActionBar
              status={status}
              dense={short}
              selectionHint={turn.selectionHint}
              busy={busy}
              canDrawStock={canDrawStock}
              canTakeDiscard={canTakeDiscard}
              discardTop={view.discardTop}
              onDrawStock={onDrawStock}
              onTakeDiscard={onTakeDiscard}
              canCancelTake={canCancelTake}
              onCancelTake={onCancelTake}
              canGroup={turn.selectionHint.valid && isMyTurn && stage === 'meld'}
              onGroup={turn.addGroup}
              canLay={turn.canLay}
              layPoints={turn.stagedPoints}
              layHint={turn.layHint}
              onLay={onLay}
              suggestion={turn.suggestion}
              onSuggest={turn.suggestion?.emptiesHand ? onRami : turn.applySuggestion}
              canDiscard={turn.canDiscard}
              onDiscard={onDiscard}
              hasSelection={turn.selected.length > 0}
              onClearSelection={turn.clearSelection}
            />

            <div className="flex items-center justify-end px-1">
              <button
                type="button"
                onClick={hand.toggle}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.64rem] font-semibold text-cream/55 transition hover:bg-white/12 hover:text-cream"
                title="Trier la main (T)"
                aria-label={`Trier la main — actuellement ${
                  hand.order === 'manual'
                    ? 'rangée à la main'
                    : hand.order === 'suit'
                      ? 'par signe'
                      : 'par valeur'
                }`}
              >
                <span aria-hidden="true">⇅ </span>
                {hand.order === 'manual'
                  ? 'Rangée à la main'
                  : hand.order === 'suit'
                    ? 'Par signe'
                    : 'Par valeur'}
              </button>
            </div>

            <RamiHandFan
              cards={hand.cards}
              selectedIds={turn.selected}
              selectionValid={turn.selectionHint.valid}
              selectionLabel={turn.selectionHint.valid ? turn.selectionHint.text : null}
              autoGroups={turn.handGroups}
              onSelectGroup={turn.selectHandGroup}
              reservedIds={turn.reservedIds}
              pinnedId={view.hints.mustUseTakenCard ? (view.turn?.takenCardId ?? null) : null}
              onToggle={turn.toggle}
              onDrop={onDropCard}
              onReorder={hand.move}
              width={size.width}
              compact={compact}
              maxCardWidth={handWidth}
              interactive={isMyTurn && !locked && !busy}
              dealStagger={0.035}
              dealOrigin={director.handOrigin}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </div>

      <FlightLayer
        flights={director.flights}
        onLanded={director.onLanded}
        reducedMotion={reducedMotion}
        renderCard={ramiFlightCard}
      />
      <RamiNotices notices={director.notices} />

      <RamiRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <RoundSummarySheet
        open={summaryOpen && view.phase === 'round_end'}
        view={view}
        onNextRound={onNextRound}
        onClose={() => setSummaryOpen(false)}
        canAdvance={Boolean(me?.isHost)}
      />

      <GameOverSheet
        open={view.phase === 'game_over'}
        view={view}
        onRestart={onRestart}
        canRestart={Boolean(me?.isHost)}
        onLeave={onLeave}
      />

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Partie">
        <div className="flex flex-col gap-3">
          <p className="text-[0.82rem] text-cream/60">
            Salle <span className="font-display text-gold-300">{code}</span> ·{' '}
            {view.players.length} joueurs
          </p>
          <Button
            variant="secondary"
            block
            onClick={() => {
              const next = !soundOn;
              sound().setEnabled(next);
              setSoundOn(next);
            }}
          >
            {soundOn ? 'Couper le son' : 'Activer le son'}
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => {
              setMenuOpen(false);
              setRulesOpen(true);
            }}
          >
            Règlement du Rami
          </Button>
          <Button variant="danger" block onClick={onLeave}>
            Quitter la table
          </Button>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cream/45">
              Raccourcis clavier
            </p>
            <ul className="grid gap-1 text-[0.74rem] text-cream/60">
              {[
                ['P', 'Piocher au talon'],
                ['R', 'Reprendre la défausse'],
                ['Entrée', 'Préparer, poser, puis jeter'],
                ['Échap', 'Annuler la sélection'],
                ['T', 'Trier la main'],
              ].map(([key, label]) => (
                <li key={key} className="flex items-center gap-2">
                  <kbd className="min-w-[3.2rem] rounded-md border border-white/15 bg-ink-950/60 px-1.5 py-0.5 text-center text-[0.66rem] font-semibold text-cream/80">
                    {key}
                  </kbd>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
