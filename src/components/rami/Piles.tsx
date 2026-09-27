'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { cardLabel } from '@/rami/cards';
import type { RamiCard } from '@/rami/types';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import { anchorKeys, useAnchors } from '@/components/game/Anchors';

interface PilesProps {
  stockCount: number;
  discardTop: RamiCard | null;
  discardCount: number;
  cardWidth: number;
  /** Le joueur peut piocher au talon. */
  canDrawStock: boolean;
  /** Le joueur peut reprendre la carte du dessus de la défausse. */
  canTakeDiscard: boolean;
  /** Une carte est sélectionnée et prête à être jetée. */
  canDropDiscard: boolean;
  onDrawStock: () => void;
  onTakeDiscard: () => void;
  onDiscard: () => void;
  /** Nombre de fois où la défausse a été recyclée dans la manche. */
  recycles: number;
  /** Carte encore en vol vers la défausse : masquée le temps du trajet. */
  hiddenCardIds?: ReadonlySet<string>;
  compact?: boolean;
}

/** Épaisseur visuelle d'un talon : quelques dos décalés, plafonnés. */
function stackDepth(count: number): number[] {
  const layers = Math.min(4, Math.max(0, Math.ceil(count / 8)));
  return Array.from({ length: layers }, (_, index) => layers - index);
}

/**
 * Pioche et défausse.
 *
 * Ce sont les deux seuls points d'entrée d'un tour : on les rend donc très
 * lisibles, avec un état d'invitation explicite quand une action est possible.
 * La défausse sert aussi de cible pour jeter — sur mobile, un seul geste.
 */
export function Piles({
  stockCount,
  discardTop,
  discardCount,
  cardWidth,
  canDrawStock,
  canTakeDiscard,
  canDropDiscard,
  onDrawStock,
  onTakeDiscard,
  onDiscard,
  recycles,
  hiddenCardIds,
  compact = false,
}: PilesProps) {
  const { bind } = useAnchors();
  const height = cardWidth / (250 / 350);
  const depth = useMemo(() => stackDepth(stockCount), [stockCount]);

  const discardAction = canDropDiscard ? onDiscard : canTakeDiscard ? onTakeDiscard : undefined;
  const discardLabel = canDropDiscard
    ? 'Jeter la carte sélectionnée'
    : canTakeDiscard && discardTop
      ? `Reprendre ${cardLabel(discardTop)}`
      : 'Défausse';

  return (
    <div className={`flex items-start ${compact ? 'gap-3' : 'gap-5'}`}>
      {/* ---------------------------------------------------------- Pioche */}
      <div className="flex flex-col items-center gap-1.5">
        <motion.button
          type="button"
          ref={bind(anchorKeys.stock)}
          disabled={!canDrawStock}
          onClick={onDrawStock}
          aria-label={`Piocher — ${stockCount} cartes au talon`}
          className="relative block will-animate no-select disabled:cursor-default"
          style={{ width: cardWidth, height }}
          whileHover={canDrawStock ? { y: -4 } : undefined}
          whileTap={canDrawStock ? { scale: 0.97 } : undefined}
          animate={
            canDrawStock
              ? { boxShadow: ['0 0 0 0 rgba(236,208,138,0)', '0 0 26px 3px rgba(236,208,138,0.45)', '0 0 0 0 rgba(236,208,138,0)'] }
              : { boxShadow: '0 0 0 0 rgba(236,208,138,0)' }
          }
          transition={{ duration: 2.2, repeat: canDrawStock ? Infinity : 0, ease: 'easeInOut' }}
        >
          {depth.map((layer) => (
            <div
              key={layer}
              className="absolute left-0 top-0"
              style={{ transform: `translate(${layer * 1.6}px, ${-layer * 1.6}px)`, opacity: 0.55 }}
            >
              <RamiPlayingCard faceDown lite width={cardWidth} elevation="none" />
            </div>
          ))}
          <div className="absolute left-0 top-0">
            <RamiPlayingCard faceDown width={cardWidth} elevation="rest" />
          </div>
          {stockCount === 0 && (
            <span className="absolute inset-0 grid place-items-center rounded-[7%] bg-ink-950/70 text-[0.64rem] font-semibold text-cream/60">
              vide
            </span>
          )}
        </motion.button>
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-cream/45">
          Pioche · <span className="tabular-nums text-cream/75">{stockCount}</span>
        </span>
      </div>

      {/* -------------------------------------------------------- Défausse */}
      <div className="flex flex-col items-center gap-1.5">
        <motion.button
          type="button"
          ref={bind(anchorKeys.discard)}
          disabled={!discardAction}
          onClick={discardAction}
          aria-label={discardLabel}
          className="relative block rounded-[7%] will-animate no-select disabled:cursor-default"
          style={{ width: cardWidth, height }}
          whileHover={discardAction ? { y: -4 } : undefined}
          whileTap={discardAction ? { scale: 0.97 } : undefined}
        >
          {discardTop ? (
            <motion.div
              key={discardTop.id}
              initial={{ opacity: 0, scale: 0.9, rotate: -8 }}
              animate={{
                opacity: hiddenCardIds?.has(discardTop.id) ? 0 : 1,
                scale: 1,
                rotate: 0,
              }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            >
              <RamiPlayingCard card={discardTop} width={cardWidth} elevation="rest" />
            </motion.div>
          ) : (
            <div
              className="grid h-full w-full place-items-center rounded-[7%] border border-dashed border-white/18 bg-white/3 px-2 text-center text-[0.6rem] font-semibold leading-tight text-cream/40"
              style={{ height }}
            >
              Défausse
              <br />
              vide
            </div>
          )}

          {canDropDiscard && (
            <motion.span
              className="pointer-events-none absolute -inset-1 rounded-[9%] border-2 border-dashed border-gold-300"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {canTakeDiscard && !canDropDiscard && (
            <motion.span
              className="pointer-events-none absolute -inset-1 rounded-[9%] border-2 border-emerald-300/80"
              initial={{ opacity: 0.35 }}
              animate={{ opacity: [0.35, 0.9, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </motion.button>
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-cream/45">
          Défausse · <span className="tabular-nums text-cream/75">{discardCount}</span>
          {recycles > 0 && (
            <span className="ml-1 text-cream/35" title="Défausse recyclée en pioche">
              ↻{recycles}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
