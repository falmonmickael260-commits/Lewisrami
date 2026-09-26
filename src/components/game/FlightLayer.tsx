'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '@/game/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { CARD_RATIO } from '@/components/card/geometry';

export interface Flight {
  id: string;
  card: Card | null;
  fromX: number;
  fromY: number;
  fromWidth: number;
  toX: number;
  toY: number;
  toWidth: number;
  rotateFrom: number;
  rotateTo: number;
  delay: number;
  duration: number;
  /** Hauteur de l'arc, en pixels. Donne son poids au lancer. */
  arc: number;
  /** Atterrissage amorti (léger rebond) — désactivé pour la distribution. */
  bounce: boolean;
}

interface FlightCardProps {
  flight: Flight;
  onLanded: (id: string) => void;
  reducedMotion: boolean;
}

/**
 * Une carte en vol.
 *
 * Trois couches imbriquées reproduisent une trajectoire crédible :
 * l'horizontale décélère, la verticale décrit un arc (montée freinée puis
 * chute accélérée), et la dernière couche porte la rotation, l'échelle et
 * le micro-rebond d'impact.
 */
function FlightCardBase({ flight, onLanded, reducedMotion }: FlightCardProps) {
  const width = flight.toWidth;
  const height = width / CARD_RATIO;
  const startScale = flight.fromWidth / flight.toWidth;
  // Le sommet de l'arc reste sous la barre supérieure : une carte ne doit
  // jamais sortir de l'écran ni passer par-dessus l'interface.
  const peakY = Math.max(76, Math.min(flight.fromY, flight.toY) - flight.arc);

  if (reducedMotion) {
    return (
      <motion.div
        className="pointer-events-none fixed left-0 top-0 will-animate"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.28, delay: flight.delay * 0.4, times: [0, 0.2, 0.8, 1] }}
        onAnimationComplete={() => onLanded(flight.id)}
        style={{ x: flight.toX, y: flight.toY }}
      >
        <div style={{ marginLeft: -width / 2, marginTop: -height / 2 }}>
          <PlayingCard
            card={flight.card ?? undefined}
            faceDown={!flight.card}
            lite={!flight.card}
            width={width}
            elevation="lift"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 will-animate"
      initial={{ x: flight.fromX }}
      animate={{ x: flight.toX }}
      transition={{
        duration: flight.duration,
        delay: flight.delay,
        ease: [0.28, 0.46, 0.2, 1],
      }}
    >
      <motion.div
        className="will-animate"
        initial={{ y: flight.fromY }}
        animate={{ y: [flight.fromY, peakY, flight.toY] }}
        transition={{
          duration: flight.duration,
          delay: flight.delay,
          times: [0, 0.46, 1],
          ease: ['easeOut', 'easeIn'],
        }}
      >
        <motion.div
          className="will-animate"
          style={{ marginLeft: -width / 2, marginTop: -height / 2 }}
          initial={{ rotate: flight.rotateFrom, scale: startScale, opacity: 0.001 }}
          animate={
            flight.bounce
              ? {
                  rotate: [flight.rotateFrom, flight.rotateFrom * 0.4, flight.rotateTo, flight.rotateTo],
                  scale: [startScale, startScale * 1.05, 1.045, 0.982, 1],
                  opacity: [1, 1, 1, 1, 1],
                }
              : {
                  rotate: [flight.rotateFrom, flight.rotateTo],
                  scale: [startScale, 1],
                  opacity: [1, 1],
                }
          }
          transition={{
            duration: flight.duration + (flight.bounce ? 0.16 : 0),
            delay: flight.delay,
            times: flight.bounce ? [0, 0.42, 0.86, 0.94, 1] : [0, 1],
            ease: 'easeOut',
          }}
          onAnimationComplete={() => onLanded(flight.id)}
        >
          <PlayingCard
            card={flight.card ?? undefined}
            faceDown={!flight.card}
            lite={!flight.card}
            width={width}
            elevation="fly"
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const FlightCard = memo(FlightCardBase);

export function FlightLayer({
  flights,
  onLanded,
  reducedMotion,
}: {
  flights: Flight[];
  onLanded: (id: string) => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
      {flights.map((flight) => (
        <FlightCard
          key={flight.id}
          flight={flight}
          onLanded={onLanded}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}
