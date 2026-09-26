'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { PlayedSet } from '@/game/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { anchorKeys, useAnchors } from './Anchors';
import { combinedOffset } from './pileLayout';

interface CenterPileProps {
  pile: PlayedSet[];
  settled: Set<string>;
  cardWidth: number;
  winnerId: string | null;
  reducedMotion: boolean;
}

const SWEEP_MS = 620;

/**
 * Le pli au centre de la table.
 *
 * Les poses ne sont affichées qu'une fois leur vol terminé, et les positions
 * utilisées ici sont exactement celles visées par les cartes en vol : une carte
 * qui atterrit ne bouge donc jamais d'un pixel au moment de son intégration.
 */
export function CenterPile({
  pile,
  settled,
  cardWidth,
  winnerId,
  reducedMotion,
}: CenterPileProps) {
  const { bind, read } = useAnchors();
  const [shown, setShown] = useState<PlayedSet[]>([]);
  const [sweep, setSweep] = useState<{ dx: number; dy: number } | null>(null);
  const shownRef = useRef<PlayedSet[]>([]);
  shownRef.current = shown;

  useEffect(() => {
    const visible = pile.filter((set) => settled.has(set.id));
    if (visible.length > 0) {
      setShown(visible);
      setSweep(null);
      return;
    }
    if (pile.length > 0) return;
    if (shownRef.current.length === 0) return;

    const pileAnchor = read(anchorKeys.pile);
    const seatAnchor = winnerId ? read(anchorKeys.seat(winnerId)) : null;
    setSweep(
      pileAnchor && seatAnchor
        ? { dx: seatAnchor.x - pileAnchor.x, dy: seatAnchor.y - pileAnchor.y }
        : { dx: 0, dy: -60 },
    );

    const timer = setTimeout(
      () => {
        setShown([]);
        setSweep(null);
      },
      reducedMotion ? 60 : SWEEP_MS,
    );
    return () => clearTimeout(timer);
  }, [pile, settled, read, winnerId, reducedMotion]);

  const topSetId = shown[shown.length - 1]?.id;

  return (
    <div className="pointer-events-none relative grid place-items-center">
      {/* Ancre unique : centre exact de la table (arrivée des poses, départ de la distribution). */}
      <div ref={bind(anchorKeys.pile)} className="absolute h-1 w-1" />
      <div ref={bind(anchorKeys.deck)} className="absolute h-1 w-1" />

      {/* Zone d'accueil : creux lumineux qui signale où atterrissent les cartes. */}
      <motion.div
        className="absolute rounded-[28px] border border-white/5"
        style={{
          width: cardWidth * 2.9,
          height: (cardWidth / 0.714) * 1.5,
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.34), rgba(0,0,0,0.05) 62%, transparent 76%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
        animate={{ opacity: shown.length > 0 ? 0.85 : 0.5 }}
        transition={{ duration: 0.4 }}
      />

      <AnimatePresence>
        {shown.map((set) =>
          set.cards.map((card, index) => {
            const offset = combinedOffset(
              set.id,
              set.order,
              index,
              set.cards.length,
              cardWidth,
            );
            const isTop = set.id === topSetId;
            return (
              <motion.div
                key={card.id}
                className="absolute will-animate"
                style={{ zIndex: 10 + set.order * 4 + index }}
                initial={false}
                animate={
                  sweep
                    ? {
                        x: offset.dx + sweep.dx,
                        y: offset.dy + sweep.dy,
                        rotate: offset.rotate + 80,
                        scale: 0.42,
                        opacity: 0,
                      }
                    : {
                        x: offset.dx,
                        y: offset.dy,
                        rotate: offset.rotate,
                        scale: 1,
                        opacity: 1,
                      }
                }
                transition={
                  sweep
                    ? { duration: SWEEP_MS / 1000, ease: [0.4, 0, 0.7, 0.2] }
                    : { type: 'spring', stiffness: 300, damping: 26 }
                }
              >
                <PlayingCard
                  card={card}
                  width={cardWidth}
                  elevation="rest"
                  style={
                    isTop
                      ? { boxShadow: '0 2px 5px rgba(0,0,0,0.35), 0 22px 40px -16px rgba(0,0,0,0.7)' }
                      : undefined
                  }
                />
              </motion.div>
            );
          }),
        )}
      </AnimatePresence>
    </div>
  );
}
