'use client';

import { memo, useId } from 'react';
import { cardLabel, isRedSuit, rankLabel } from '@/rami/cards';
import type { RamiCard, RamiRank, Suit } from '@/rami/types';
import {
  ACE_PIP_SIZE,
  CARD_H,
  CARD_RADIUS,
  CARD_W,
  PIP_SIZE,
  pipLayoutForCount,
} from '@/components/card/geometry';
import { SuitPip } from '@/components/card/Suit';
import { CourtFigure } from '@/components/card/CourtFigure';
import { JokerArt, Star } from './JokerArt';

/**
 * Face de carte du Rami, **entièrement vectorielle**.
 *
 * Aucune image bitmap n'entre dans le rendu : enseignes, chiffres, figures et
 * joker sont des tracés SVG paramétriques. La carte reste donc parfaitement
 * nette sur mobile, Retina, 2K et 4K, à n'importe quelle échelle et pendant
 * les animations — y compris agrandie dans une combinaison.
 *
 * Les valeurs du Rami sont l'ordre naturel : As, 2 … 10, Valet, Dame, Roi.
 */

const RED = '#c2223c';
const BLACK = '#18222b';
/** Les jokers alternent rouge et noir, comme dans un jeu du commerce. */
const JOKER_COLORS = [RED, BLACK];

const PANEL = { x: 44, y: 56, w: 162, h: 238 };

function FaceArt({
  card,
  color,
  courtFill,
  goldFill,
  clipId,
}: {
  card: RamiCard;
  color: string;
  courtFill: string;
  goldFill: string;
  clipId: string;
}) {
  if (card.joker) {
    return <JokerArt color={color} gold={goldFill} courtFill={courtFill} clipId={clipId} />;
  }

  const rank = card.rank as RamiRank;
  const suit = card.suit as Suit;

  // L'As : une grande enseigne centrale, cerclée, comme sur un jeu traditionnel.
  if (rank === 1) {
    return (
      <g fill={color}>
        <circle cx={125} cy={175} r={86} fill="none" stroke={color} strokeWidth={1.1} opacity={0.22} />
        <circle cx={125} cy={175} r={76} fill="none" stroke={color} strokeWidth={0.7} opacity={0.14} />
        <SuitPip suit={suit} x={125} y={175} size={ACE_PIP_SIZE} />
      </g>
    );
  }

  // Figures : composition héraldique, lisible même très réduite.
  if (rank >= 11) {
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

  // 2 à 10 : les enseignes aux positions traditionnelles.
  return (
    <g fill={color}>
      {pipLayoutForCount(rank).map((pip, index) => (
        <SuitPip
          key={index}
          suit={suit}
          x={pip.x}
          y={pip.y}
          size={rank === 2 ? 56 : PIP_SIZE}
          flip={pip.flip}
        />
      ))}
    </g>
  );
}

export interface RamiCardFaceProps {
  card: RamiCard;
  /** Atténue la carte lorsqu'elle n'est pas jouable. */
  dimmed?: boolean;
  className?: string;
}

function RamiCardFaceBase({ card, dimmed = false, className }: RamiCardFaceProps) {
  const uid = useId().replace(/:/g, '');
  const color = card.joker
    ? JOKER_COLORS[card.deck % JOKER_COLORS.length]
    : isRedSuit(card.suit as Suit)
      ? RED
      : BLACK;
  const label = card.joker ? '★' : rankLabel(card.rank as RamiRank);
  const framed = card.joker;

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

      {/* Le joker porte un liseré doré : on le reconnaît d'un coup d'œil. */}
      {framed && (
        <rect
          x={7}
          y={7}
          width={CARD_W - 14}
          height={CARD_H - 14}
          rx={CARD_RADIUS - 5}
          fill="none"
          stroke={`url(#gold-${uid})`}
          strokeWidth={2.4}
          opacity={0.95}
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
          {card.joker ? (
            <>
              <g transform="translate(25 48)">
                <Star r={17} />
              </g>
              <text
                x={25}
                y={84}
                textAnchor="middle"
                fontFamily="var(--font-sans)"
                fontWeight={800}
                fontSize={16}
                letterSpacing="-0.5"
              >
                JKR
              </text>
            </>
          ) : (
            <>
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
              <SuitPip suit={card.suit as Suit} x={25} y={78} size={25} />
            </>
          )}
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

export const RamiCardFace = memo(RamiCardFaceBase);
