'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { rankName } from '@/game/cards';
import type { Rank } from '@/game/types';
import type { CarreMoment } from '@/hooks/useDirector';

const DURATION = 2500;

function particles(token: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (token % 7) * 0.31;
    const distance = 130 + ((token * (index + 3)) % 130);
    return {
      id: index,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.72,
      size: 3 + ((token + index * 5) % 5),
      delay: 0.04 + (index % 6) * 0.018,
    };
  });
}

/**
 * Moment fort du carré : impact, onde, éclat et particules, puis fermeture du pli.
 * Toute la séquence tient en transformations et opacités (60 FPS garantis).
 */
export function CarreOverlay({
  moment,
  playerName,
  reducedMotion,
}: {
  moment: CarreMoment | null;
  playerName: string;
  reducedMotion: boolean;
}) {
  const [visible, setVisible] = useState<CarreMoment | null>(null);

  useEffect(() => {
    if (!moment) return;
    setVisible(moment);
    const timer = setTimeout(() => setVisible(null), reducedMotion ? 1400 : DURATION);
    return () => clearTimeout(timer);
  }, [moment, reducedMotion]);

  const bits = useMemo(() => particles(visible?.token ?? 1, 26), [visible?.token]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="absolute inset-0 bg-ink-950"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.52, 0.42, 0] }}
            transition={{ duration: DURATION / 1000, times: [0, 0.1, 0.72, 1] }}
          />

          {!reducedMotion && (
            <>
              {/* Éclat central */}
              <motion.div
                className="absolute h-[52vmin] w-[52vmin] rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,246,214,0.85) 0%, rgba(236,208,138,0.35) 34%, transparent 68%)',
                }}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [0.2, 1.25, 1.6], opacity: [0, 0.95, 0] }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
              />
              {/* Onde de choc */}
              <motion.div
                className="absolute rounded-full border-2 border-gold-300/70"
                style={{ width: '24vmin', height: '24vmin' }}
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 4.2, opacity: 0 }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
              {bits.map((bit) => (
                <motion.span
                  key={bit.id}
                  className="absolute rounded-full bg-gold-300"
                  style={{ width: bit.size, height: bit.size }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{
                    x: bit.x,
                    y: bit.y,
                    opacity: [0, 1, 0],
                    scale: [0.4, 1, 0.2],
                  }}
                  transition={{ duration: 1.1, delay: bit.delay, ease: 'easeOut' }}
                />
              ))}
            </>
          )}

          {/* Le bloc de texte descend sous le pli : les quatre cartes restent
              entièrement visibles pendant tout le moment. */}
          <div
            className="relative flex flex-col items-center gap-2 px-6 text-center"
            style={{ transform: 'translateY(7vh)' }}
          >
            <motion.div
              initial={{ scale: 0.55, opacity: 0, rotate: -6 }}
              animate={{ scale: [0.55, 1.12, 1], opacity: 1, rotate: 0 }}
              transition={{ duration: 0.6, times: [0, 0.6, 1], ease: [0.16, 1, 0.3, 1] }}
              className="text-gradient-gold font-display text-[clamp(2.8rem,13vw,6rem)] leading-none"
              style={{ textShadow: '0 10px 34px rgba(0,0,0,0.75)' }}
            >
              CARRÉ
            </motion.div>
            <motion.p
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.24, duration: 0.4 }}
              className="text-lg font-semibold tracking-tight text-cream"
            >
              {playerName} pose quatre {rankName(visible.rank as Rank, true)}
            </motion.p>
            <motion.p
              initial={{ y: 10, opacity: 0, letterSpacing: '0.5em' }}
              animate={{ y: 0, opacity: 1, letterSpacing: '0.28em' }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="text-[0.78rem] font-bold uppercase tracking-[0.28em] text-gold-400"
            >
              Pli fermé — il reprend la main
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
