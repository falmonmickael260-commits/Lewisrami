'use client';

import { memo, useId } from 'react';
import { cardLabel, isRedSuit, rankLabel } from '@/game/cards';
import type { Card, Suit } from '@/game/types';
import {
  ACE_PIP_SIZE,
  CARD_H,
  CARD_RADIUS,
  CARD_W,
  PIP_SIZE,
  pipLayout,
} from './geometry';
import { SuitPip } from './Suit';
import { CourtFigure } from './CourtFigure';

const RED = '#c2223c';
const BLACK = '#18222b';

const PANEL = { x: 44, y: 56, w: 162, h: 238 };

function FaceArt({
  card,
  color,
  courtFill,
  goldFill,
  clipId,
}: {
  card: Card;
  color: string;
  courtFill: string;
  goldFill: string;
  clipId: string;
}) {
  const { rank, suit } = card;

  if (rank === 14) {
    return (
      <g fill={color}>
        <circle cx={125} cy={175} r={86} fill="none" stroke={color} strokeWidth={1.1} opacity={0.22} />
        <circle cx={125} cy={175} r={76} fill="none" stroke={color} strokeWidth={0.7} opacity={0.14} />
        <SuitPip suit={suit} x={125} y={175} size={ACE_PIP_SIZE} />
      </g>
    );
  }

  if (rank >= 11 && rank <= 13) {
    const letter = rankLabel(rank) as 'V' | 'D' | 'R';
    return (
      <g>
        <rect
          x={PANEL.x}
          y={PANEL.y}
          width={PANEL.w}
          height={PANEL.h}
          rx={11}
          fill={courtFill}
          stroke={color}
          strokeWidth={1}
        />
        <rect
          x={PANEL.x + 5}
          y={PANEL.y + 5}
          width={PANEL.w - 10}
          height={PANEL.h - 10}
          rx={7}
          fill="none"
          stroke={color}
          strokeWidth={0.7}
          opacity={0.28}
        />
        <clipPath id={clipId}>
          <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={11} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {/* Filigrane central : remplit le cœur du cartouche sans gêner la lecture. */}
          <g fill={color} opacity={0.055}>
            <SuitPip suit={suit} x={125} y={175} size={124} />
          </g>
          <CourtFigure letter={letter} suit={suit} color={color} gold={goldFill} />
          <g transform={`translate(${CARD_W} ${CARD_H}) rotate(180)`}>
            <CourtFigure letter={letter} suit={suit} color={color} gold={goldFill} />
          </g>
        </g>
        <line
          x1={PANEL.x + 6}
          y1={PANEL.y + PANEL.h - 6}
          x2={PANEL.x + PANEL.w - 6}
          y2={PANEL.y + 6}
          stroke={color}
          strokeWidth={0.7}
          opacity={0.2}
        />
      </g>
    );
  }

  return (
    <g fill={color}>
      {pipLayout(rank).map((pip, index) => (
        <SuitPip
          key={index}
          suit={suit}
          x={pip.x}
          y={pip.y}
          size={rank === 15 ? 56 : PIP_SIZE}
          flip={pip.flip}
        />
      ))}
    </g>
  );
}

export interface CardFaceProps {
  card: Card;
  /** Atténue la carte lorsqu'elle n'est pas jouable. */
  dimmed?: boolean;
  className?: string;
}

/**
 * Face de carte entièrement vectorielle : aucune image bitmap n'est utilisée,
 * donc aucune pixelisation, quelle que soit la densité d'écran ou l'échelle.
 */
function CardFaceBase({ card, dimmed = false, className }: CardFaceProps) {
  const uid = useId().replace(/:/g, '');
  const color = isRedSuit(card.suit) ? RED : BLACK;
  const label = rankLabel(card.rank);
  const isTwo = card.rank === 15;

  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={className}
      role="img"
      aria-label={cardLabel(card)}
      style={{ display: 'block', width: '100%', height: '100%' }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id={`paper-${uid}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fbfaf5" />
          <stop offset="100%" stopColor="#efebe0" />
        </linearGradient>
        <linearGradient id={`court-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#fffdf7" />
          <stop offset="52%" stopColor="#f5f0e2" />
          <stop offset="100%" stopColor="#fffdf7" />
        </linearGradient>
        <linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e7c983" />
          <stop offset="50%" stopColor="#b8903f" />
          <stop offset="100%" stopColor="#e7c983" />
        </linearGradient>
      </defs>

      <rect
        x={0.75}
        y={0.75}
        width={CARD_W - 1.5}
        height={CARD_H - 1.5}
        rx={CARD_RADIUS}
        fill={`url(#paper-${uid})`}
        stroke="rgba(24,34,43,0.18)"
        strokeWidth={1.5}
      />

      {isTwo && (
        <rect
          x={7}
          y={7}
          width={CARD_W - 14}
          height={CARD_H - 14}
          rx={CARD_RADIUS - 5}
          fill="none"
          stroke={`url(#gold-${uid})`}
          strokeWidth={2}
          opacity={0.9}
        />
      )}

      <FaceArt
        card={card}
        color={color}
        courtFill={`url(#court-${uid})`}
        goldFill={`url(#gold-${uid})`}
        clipId={`clip-${uid}`}
      />

      {/* Index de coin, en symétrie centrale comme sur un vrai jeu. */}
      {[false, true].map((flipped) => (
        <g
          key={String(flipped)}
          transform={flipped ? `translate(${CARD_W} ${CARD_H}) rotate(180)` : undefined}
          fill={color}
        >
          <text
            x={25}
            y={52}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontWeight={800}
            fontSize={label.length > 1 ? 35 : 42}
            letterSpacing={label.length > 1 ? '-2.5' : '0'}
          >
            {label}
          </text>
          <SuitPip suit={card.suit} x={25} y={78} size={25} />
        </g>
      ))}

      {dimmed && (
        <rect
          x={0}
          y={0}
          width={CARD_W}
          height={CARD_H}
          rx={CARD_RADIUS}
          fill="#0b1014"
          opacity={0.28}
        />
      )}
    </svg>
  );
}

export const CardFace = memo(CardFaceBase);
