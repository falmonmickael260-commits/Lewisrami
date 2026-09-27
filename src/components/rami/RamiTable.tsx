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
import type { GameRoomHandle } from '@/hooks/useGameRoom';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
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

/** Largeur d'une carte de combinaison, adaptée à la place disponible. */
function meldCardWidth(width: number): number {
  if (width === 0) return 52;
  if (width < 400) return 40;
  if (width < 640) return 46;
  if (width < 900) return 54;
  if (width < 1280) return 60;
  return 66;
}

function pileCardWidth(width: number): number {
  if (width === 0) return 68;
  if (width < 400) return 58;
  if (width < 640) return 66;
  if (width < 900) return 76;
  return 88;
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

  const compact = size.width > 0 && size.width < 700;
  const tableCardWidth = useMemo(() => meldCardWidth(size.width), [size.width]);
  const pileWidth = useMemo(() => pileCardWidth(size.width), [size.width]);

  const isMyTurn = Boolean(view && view.currentPlayerId === view.youId);
  const turn = useRamiTurn(view, isMyTurn);

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
    (cardId: string, point: { x: number; y: number }) => {
      const current = room.view;
      if (!current || current.phase !== 'playing') return;
      if (current.currentPlayerId !== current.youId) return;
      if (current.turn?.stage !== 'meld') return;

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
        if (current.hints.mustUseTakenCard || turn.groups.length > 0) return;
        director.captureCards([cardId]);
        void guarded('discard', { cardId }).then((ok) => {
          if (ok) turn.clearSelection();
        });
        return;
      }

      // Lâchée sur une combinaison : complément, si elle l'accepte.
      for (const meld of current.melds) {
        if (!hits(anchorKeys.meld(meld.id), 8)) continue;
        const card = current.hand.find((entry) => entry.id === cardId);
        if (!card) return;
        if (turn.affordanceFor(meld) === 'none') return;
        if (!extendMeldWith(meld, [card]).ok) {
          director.pushNotice(
            'Cette carte ne complète pas cette combinaison.',
            'warn',
          );
          return;
        }
        director.captureCards([cardId]);
        void guarded('extend_meld', { meldId: meld.id, cardIds: [cardId] }).then((ok) => {
          if (ok) turn.clearSelection();
        });
        return;
      }
    },
    [room.view, read, turn, director, guarded],
  );

  const onNextRound = useCallback(() => void guarded('next_round'), [guarded]);
  const onRestart = useCallback(() => void guarded('restart'), [guarded]);

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
  const opponents = view.players.filter((player) => player.id !== view.youId);
  const status = buildRamiStatus(view);
  const stage = view.turn?.stage ?? 'draw';
  const locked = view.phase !== 'playing';

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
        {/* ------------------------------------------------- Adversaires */}
        <div className="flex shrink-0 flex-wrap items-start justify-center gap-1.5 px-2 pb-1">
          {opponents.map((player) => (
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
            />
          ))}
        </div>

        {/* -------------------------------------- Pioche, défausse, tapis */}
        {/* L'aire de jeu est centrée verticalement : une table vide ne doit pas
            laisser un grand vide entre la pioche et la main. */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
          <div className="relative mx-auto flex max-h-full w-full max-w-5xl flex-col gap-2 sm:flex-row sm:gap-4">
          {/* Incrustation du tapis : ancre visuellement l'aire de jeu, pour
              qu'une table encore vide ressemble à une table et non à du vide. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 -inset-y-4 rounded-[2rem] border border-gold-500/10 sm:-inset-x-5 sm:-inset-y-6"
            style={{
              background:
                'radial-gradient(75% 95% at 50% 45%, rgb(255 255 255 / 0.05), transparent 72%)',
              boxShadow:
                'inset 0 1px 0 rgb(255 255 255 / 0.05), 0 50px 110px -70px rgb(0 0 0 / 0.95)',
            }}
          />
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
          </div>
        </div>

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
              onSuggest={turn.applySuggestion}
              canDiscard={turn.canDiscard}
              onDiscard={onDiscard}
              hasSelection={turn.selected.length > 0}
              onClearSelection={turn.clearSelection}
            />

            <RamiHandFan
              cards={view.hand}
              selectedIds={turn.selected}
              reservedIds={turn.reservedIds}
              pinnedId={view.hints.mustUseTakenCard ? (view.turn?.takenCardId ?? null) : null}
              onToggle={turn.toggle}
              onDrop={onDropCard}
              width={size.width}
              compact={compact}
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
        </div>
      </Sheet>
    </div>
  );
}
