'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { SuitPip } from '@/components/card/Suit';
import type { Suit } from '@/rami/types';

/**
 * Le moment fort d'une partie de Rami.
 *
 * Quand quelqu'un termine, il ne se passait rien : un panneau de scores
 * apparaissait, et c'était tout. Or c'est l'instant qu'on attend pendant
 * toute la manche. Un tampon vient donc claquer sur la table, la pluie de
 * confettis tombe aux couleurs des enseignes, et le décompte arrive ensuite,
 * une fois la fête passée.
 *
 * Tout est vectoriel et calculé une seule fois : la célébration ne doit pas
 * faire tomber les images par terre sur un téléphone d'entrée de gamme.
 *
 * Le voile passe très haut dans les plans : les cartes en main montent
 * jusqu'au plan 600 pour se détacher de leurs voisines, et sans cela la fête
 * n'assombrirait que la moitié haute de l'écran.
 */

/** Durée de la fête avant que le décompte prenne la main, en millisecondes. */
export const CELEBRATION_MS = 2300;

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RED = '#e0485f';
const BLACK = '#1d2b36';
const GOLD = '#f0c46a';
const CREAM = '#f6e3b0';

/** Un confetti : enseigne ou ruban, lâché d'en haut avec sa propre dérive. */
interface Confetto {
  id: number;
  /** Position de départ, en pourcentage de la largeur. */
  left: number;
  /** Dérive horizontale pendant la chute, en pixels. */
  drift: number;
  delay: number;
  duration: number;
  spin: number;
  size: number;
  color: string;
  suit: Suit | null;
}

/**
 * Tirage déterministe : deux appareils affichent la même fête, et surtout le
 * rendu serveur et le rendu client ne divergent pas.
 */
function makeConfetti(count: number, seed: number): Confetto[] {
  let state = seed || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, (_, id) => {
    const suited = random() < 0.55;
    const suit = suited ? SUITS[Math.floor(random() * SUITS.length)] : null;
    const red = suit === 'H' || suit === 'D';
    return {
      id,
      left: random() * 100,
      drift: (random() - 0.5) * 180,
      delay: random() * 0.75,
      duration: 1.5 + random() * 1.1,
      spin: (random() - 0.5) * 900,
      size: 12 + random() * 16,
      color: suit ? (red ? RED : BLACK) : random() < 0.6 ? GOLD : CREAM,
      suit,
    };
  });
}

export interface CelebrationProps {
  open: boolean;
  /** Le mot qui claque : « RAMI ! » en fin de manche, « VICTOIRE ! » en fin de partie. */
  title: string;
  /** Qui a gagné, en une ligne. */
  subtitle: string;
  /** La fête est la vôtre : on l'amplifie. */
  mine: boolean;
  reducedMotion: boolean;
}

export function Celebration({ open, title, subtitle, mine, reducedMotion }: CelebrationProps) {
  // Plus de confettis quand c'est vous qui gagnez — et aucun si l'on a demandé
  // à réduire les animations.
  const confetti = useMemo(
    () => (reducedMotion ? [] : makeConfetti(mine ? 90 : 55, title.length * 7919 + 13)),
    [reducedMotion, mine, title],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="celebration"
          className="pointer-events-none fixed inset-0 z-[1100] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          role="status"
          aria-live="polite"
          aria-label={`${title} ${subtitle}`}
        >
          {/* Le tapis s'assombrit juste assez pour que l'or ressorte. */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(62% 46% at 50% 48%, rgba(4,12,9,0.74), rgba(4,12,9,0.88))',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          />

          {confetti.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute top-0"
              style={{ left: `${piece.left}%` }}
              initial={{ y: '-12vh', x: 0, rotate: 0, opacity: 0 }}
              animate={{
                y: '108vh',
                x: piece.drift,
                rotate: piece.spin,
                opacity: [0, 1, 1, 0.9, 0],
              }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                ease: 'easeIn',
                opacity: { duration: piece.duration, delay: piece.delay, times: [0, 0.08, 0.6, 0.85, 1] },
              }}
            >
              {piece.suit ? (
                <svg
                  width={piece.size}
                  height={piece.size}
                  viewBox="-22 -22 44 44"
                  aria-hidden="true"
                >
                  <g fill={piece.color}>
                    <SuitPip suit={piece.suit} x={0} y={0} size={40} />
                  </g>
                </svg>
              ) : (
                <div
                  style={{
                    width: piece.size * 0.42,
                    height: piece.size,
                    borderRadius: 2,
                    background: piece.color,
                    boxShadow: `0 0 8px ${piece.color}66`,
                  }}
                />
              )}
            </motion.div>
          ))}

          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="relative grid place-items-center">
              {/* Onde de choc : le tampon frappe la table. */}
              {!reducedMotion && (
                <motion.span
                  aria-hidden="true"
                  className="absolute rounded-full border-2"
                  style={{ borderColor: GOLD }}
                  initial={{ width: 40, height: 40, opacity: 0.85 }}
                  animate={{ width: 460, height: 460, opacity: 0 }}
                  transition={{ duration: 0.8, delay: 0.14, ease: 'easeOut' }}
                />
              )}

              <motion.span
                aria-hidden="true"
                className="absolute rounded-full"
                style={{
                  width: 320,
                  height: 190,
                  background:
                    'radial-gradient(closest-side, rgba(4,12,9,0.92), rgba(4,12,9,0))',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />

              <motion.p
                className="text-gradient-gold font-display text-center text-7xl leading-none drop-shadow-[0_10px_34px_rgba(0,0,0,0.9)] sm:text-8xl"
                initial={reducedMotion ? { opacity: 0 } : { scale: 3.2, opacity: 0, rotate: -14 }}
                animate={
                  reducedMotion
                    ? { opacity: 1 }
                    : { scale: 1, opacity: 1, rotate: -6 }
                }
                transition={
                  reducedMotion
                    ? { duration: 0.2 }
                    : { type: 'spring', stiffness: 420, damping: 15, mass: 0.9 }
                }
              >
                {title}
              </motion.p>

              <motion.p
                className="mt-3 text-center text-[0.95rem] font-semibold text-cream/85"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {subtitle}
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
