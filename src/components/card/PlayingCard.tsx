'use client';

import { memo } from 'react';
import type { Card } from '@/game/types';
import { CARD_RATIO } from './geometry';
import { CardBack } from './CardBack';
import { CardFace } from './CardFace';

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  dimmed?: boolean;
  /** Largeur en pixels CSS. La hauteur suit le ratio exact d'une carte à jouer. */
  width: number;
  className?: string;
  /** Ombre portée : `rest` posée, `lift` soulevée, `fly` en vol, `none` gérée par le parent. */
  elevation?: 'none' | 'rest' | 'lift' | 'fly';
  style?: React.CSSProperties;
}

const SHADOWS: Record<NonNullable<PlayingCardProps['elevation']>, string> = {
  none: 'none',
  rest: 'var(--shadow-card-rest)',
  lift: 'var(--shadow-card-lift)',
  fly: 'var(--shadow-card-fly)',
};

/**
 * Objet « carte » : conteneur au ratio exact, coins arrondis proportionnels,
 * ombre cohérente. Le contenu est toujours vectoriel.
 */
function PlayingCardBase({
  card,
  faceDown = false,
  dimmed = false,
  width,
  className,
  elevation = 'rest',
  style,
}: PlayingCardProps) {
  return (
    <div
      className={`relative overflow-hidden no-select ${className ?? ''}`}
      style={{
        width,
        height: width / CARD_RATIO,
        borderRadius: `${(18 / 250) * 100}%`,
        boxShadow: SHADOWS[elevation],
        background: faceDown || !card ? '#081a27' : '#fbfaf5',
        ...style,
      }}
    >
      {faceDown || !card ? <CardBack /> : <CardFace card={card} dimmed={dimmed} />}
    </div>
  );
}

export const PlayingCard = memo(PlayingCardBase);
