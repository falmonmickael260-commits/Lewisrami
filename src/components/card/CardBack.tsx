'use client';

import { memo, useId } from 'react';
import { CARD_H, CARD_RADIUS, CARD_W } from './geometry';

/**
 * Dos de carte vectoriel : treillis guilloché + médaillon central.
 * Entièrement en SVG, donc net sur tous les écrans (mobile, Retina, 4K).
 */
function CardBackBase({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={className}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#123a52" />
          <stop offset="45%" stopColor="#0c2739" />
          <stop offset="100%" stopColor="#081a27" />
        </linearGradient>
        <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0d79a" />
          <stop offset="48%" stopColor="#a9822f" />
          <stop offset="100%" stopColor="#f0d79a" />
        </linearGradient>
        <pattern
          id={`lattice-${uid}`}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path
            d="M10 0v20M0 10h20"
            stroke="#e9cd8d"
            strokeWidth="0.9"
            opacity="0.34"
            fill="none"
          />
          <circle cx="10" cy="10" r="1.7" fill="#e9cd8d" opacity="0.4" />
        </pattern>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.42" r="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect
        x={0.75}
        y={0.75}
        width={CARD_W - 1.5}
        height={CARD_H - 1.5}
        rx={CARD_RADIUS}
        fill={`url(#bg-${uid})`}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={1.5}
      />
      <rect
        x={12}
        y={12}
        width={CARD_W - 24}
        height={CARD_H - 24}
        rx={CARD_RADIUS - 6}
        fill={`url(#lattice-${uid})`}
      />
      <rect
        x={12}
        y={12}
        width={CARD_W - 24}
        height={CARD_H - 24}
        rx={CARD_RADIUS - 6}
        fill="none"
        stroke={`url(#rim-${uid})`}
        strokeWidth={1.6}
        opacity={0.75}
      />
      <rect
        x={20}
        y={20}
        width={CARD_W - 40}
        height={CARD_H - 40}
        rx={CARD_RADIUS - 10}
        fill="none"
        stroke="#e9cd8d"
        strokeWidth={0.6}
        opacity={0.35}
      />

      <g transform={`translate(${CARD_W / 2} ${CARD_H / 2})`}>
        <ellipse rx="52" ry="66" fill="#081a27" opacity="0.88" />
        <ellipse
          rx="52"
          ry="66"
          fill="none"
          stroke={`url(#rim-${uid})`}
          strokeWidth="1.6"
        />
        <ellipse rx="44" ry="58" fill="none" stroke="#e9cd8d" strokeWidth="0.6" opacity="0.5" />
        <path
          d="M-26 16 L-22 -12 L-11 -1 L0 -18 L11 -1 L22 -12 L26 16 Z"
          fill={`url(#rim-${uid})`}
        />
        <rect x="-26" y="20" width="52" height="5" rx="2.5" fill={`url(#rim-${uid})`} />
      </g>

      <rect
        x={0.75}
        y={0.75}
        width={CARD_W - 1.5}
        height={CARD_H - 1.5}
        rx={CARD_RADIUS}
        fill={`url(#glow-${uid})`}
      />
    </svg>
  );
}

export const CardBack = memo(CardBackBase);
