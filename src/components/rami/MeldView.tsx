'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { describeTarget, shortLabel } from '@/rami/cards';
import { describeJokerRequirement, meldLabel, meldPoints } from '@/rami/melds';
import type { Meld } from '@/rami/types';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import { anchorKeys, useAnchors } from '@/components/game/Anchors';
import { teamStyle } from './theme';

export type MeldAffordance = 'none' | 'extend' | 'reclaim' | 'blocked';

interface MeldViewProps {
  meld: Meld;
  cardWidth: number;
  /** Ce que la sélection courante permet de faire sur cette combinaison. */
  affordance: MeldAffordance;
  onActivate?: (meld: Meld) => void;
  /** Cartes arrivées à l'instant : elles entrent en animation. */
  freshCardIds?: ReadonlySet<string>;
  /** Cartes encore en vol : masquées ici tant qu'elles n'ont pas atterri. */
  hiddenCardIds?: ReadonlySet<string>;
  /** Nom de l'équipe propriétaire, affiché au-dessus. */
  ownerLabel: string;
  compact?: boolean;
}

/**
 * Une combinaison posée.
 *
 * Les cartes se chevauchent : une tierce de onze cartes doit tenir sur un
 * téléphone sans réduire les cartes au point de les rendre illisibles. Le
 * chevauchement s'ouvre sur les grands écrans.
 *
 * Une combinaison posée ne se réorganise jamais : aucune carte n'est
 * déplaçable ici, et le seul geste possible est de **compléter** l'ensemble ou
 * d'en **remplacer le joker**.
 */
function MeldViewBase({
  meld,
  cardWidth,
  affordance,
  onActivate,
  freshCardIds,
  hiddenCardIds,
  ownerLabel,
  compact = false,
}: MeldViewProps) {
  const { bind } = useAnchors();
  const style = teamStyle(meld.teamId);
  const overlap = compact ? 0.42 : 0.5;
  const step = cardWidth * overlap;
  const height = cardWidth / (250 / 350);

  const points = useMemo(() => meldPoints(meld), [meld]);
  const label = useMemo(() => meldLabel(meld), [meld]);
  const jokerHint = useMemo(() => describeJokerRequirement(meld), [meld]);

  const interactive = affordance === 'extend' || affordance === 'reclaim';
  const Wrapper = interactive ? motion.button : motion.div;

  return (
    <Wrapper
      ref={bind(anchorKeys.meld(meld.id))}
      type={interactive ? 'button' : undefined}
      onClick={interactive && onActivate ? () => onActivate(meld) : undefined}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      whileHover={interactive ? { y: -3 } : undefined}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      aria-label={
        interactive
          ? `${label} — ${affordance === 'reclaim' ? 'récupérer le joker' : 'compléter'}`
          : label
      }
      className={[
        'relative rounded-2xl border px-2.5 pb-2 pt-1.5 text-left transition-colors',
        interactive ? 'cursor-pointer' : 'cursor-default',
        affordance === 'blocked' ? 'opacity-45 saturate-50' : '',
      ].join(' ')}
      style={{
        background: style.surface,
        borderColor: interactive ? style.accent : style.border,
        boxShadow: interactive
          ? `0 0 0 1px ${style.border}, 0 14px 34px -20px ${style.glow}, 0 0 26px -10px ${style.glow}`
          : `0 10px 26px -20px rgba(0,0,0,0.9)`,
      }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span
          className="truncate text-[0.6rem] font-bold uppercase tracking-[0.13em]"
          style={{ color: style.accent }}
        >
          {ownerLabel}
        </span>
        <span className="shrink-0 text-[0.6rem] font-semibold tabular-nums text-cream/45">
          {points} pts
        </span>
      </div>

      <div
        className="relative"
        style={{ width: cardWidth + step * Math.max(0, meld.slots.length - 1), height }}
      >
        {meld.slots.map((slot, index) => {
          const fresh = freshCardIds?.has(slot.card.id) ?? false;
          // Une carte encore en vol est réservée ici, mais pas dessinée :
          // sinon elle apparaîtrait à destination avant d'y être arrivée.
          const inFlight = hiddenCardIds?.has(slot.card.id) ?? false;
          return (
            <motion.div
              key={slot.card.id}
              className="absolute top-0 will-animate"
              style={{ left: index * step, zIndex: index }}
              initial={fresh ? { opacity: 0, y: -18, rotate: -6, scale: 0.9 } : false}
              animate={{ opacity: inFlight ? 0 : 1, y: 0, rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <RamiPlayingCard card={slot.card} width={cardWidth} elevation="rest" />
              {slot.card.joker && slot.jokerRole && (
                <span
                  className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-gold-500/50 bg-ink-950/90 px-1.5 py-[1px] text-[0.52rem] font-bold uppercase tracking-wider text-gold-300"
                  title={`Ce joker représente ${describeTarget(slot.jokerRole.rank, slot.jokerRole.suit)}`}
                >
                  ={' '}
                  {slot.jokerRole.suit
                    ? shortLabel({
                        id: '',
                        rank: slot.jokerRole.rank,
                        suit: slot.jokerRole.suit,
                        joker: false,
                        deck: 0,
                      })
                    : describeTarget(slot.jokerRole.rank, null)}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {affordance === 'reclaim' && jokerHint && (
        <span className="mt-1.5 block text-[0.6rem] font-semibold text-gold-300">
          Récupérer le joker
        </span>
      )}
      {affordance === 'extend' && (
        <span className="mt-1.5 block text-[0.6rem] font-semibold" style={{ color: style.accent }}>
          Compléter ici
        </span>
      )}
    </Wrapper>
  );
}

export const MeldView = memo(MeldViewBase);
