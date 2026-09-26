'use client';

import { useEffect, useRef } from 'react';
import { sound } from '@/lib/sound';

interface TurnTimerProps {
  deadline: number | null;
  totalMs: number;
  /** Décalage horloge serveur − horloge locale. */
  skew: number;
  size: number;
  /** Joue un signal sonore d'urgence (uniquement pour le joueur concerné). */
  alert?: boolean;
}

/**
 * Anneau de progression du tour.
 *
 * L'animation est pilotée en `requestAnimationFrame` et écrit directement dans
 * le DOM : aucun rendu React par frame, donc aucun impact sur les 60 FPS.
 */
export function TurnTimer({ deadline, totalMs, skew, size, alert = false }: TurnTimerProps) {
  const circleRef = useRef<SVGCircleElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const warned = useRef({ ten: false, five: false });

  const stroke = Math.max(2.5, size * 0.055);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    warned.current = { ten: false, five: false };
  }, [deadline]);

  useEffect(() => {
    if (deadline === null) return;
    let frame = 0;

    const tick = () => {
      const remaining = Math.max(0, deadline - (Date.now() + skew));
      const ratio = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0;
      const circle = circleRef.current;
      const wrap = wrapRef.current;

      if (circle) {
        circle.style.strokeDashoffset = String(circumference * (1 - ratio));
        const seconds = remaining / 1000;
        circle.style.stroke =
          seconds <= 5 ? '#f2606a' : seconds <= 10 ? '#ecd08a' : '#5fd8a4';
      }
      if (wrap) {
        const seconds = remaining / 1000;
        // Pulsation d'urgence : visible sans dépendre uniquement de la couleur.
        wrap.style.transform =
          seconds <= 5 && seconds > 0
            ? `scale(${1 + Math.sin(Date.now() / 90) * 0.035})`
            : 'scale(1)';
      }

      if (alert) {
        const seconds = remaining / 1000;
        if (seconds <= 10 && seconds > 9.4 && !warned.current.ten) {
          warned.current.ten = true;
          sound().play('select');
        }
        if (seconds <= 5 && seconds > 4.4 && !warned.current.five) {
          warned.current.five = true;
          sound().play('error');
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [deadline, skew, totalMs, circumference, alert]);

  if (deadline === null) return null;

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 will-animate">
      <svg width={size} height={size} className="block -rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#5fd8a4"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={0}
          style={{ transition: 'stroke 400ms linear' }}
        />
      </svg>
    </div>
  );
}
