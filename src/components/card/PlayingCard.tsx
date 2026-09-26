'use client';

import { memo } from 'react';
import type { Card } from '@/game/types';
import { CARD_RATIO } from './geometry';
import { CardBack } from './CardBack';
import { CardBackLite } from './CardBackLite';
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
  /** Dos allégé (dégradés CSS) pour les cartes nombreuses en mouvement. */
  lite?: boolean;
  style?: React.CSSProperties;
}

/**
 * L'ombre est proportionnelle à la carte : une ombre de 70 px sous une carte
 * de 45 px ressemblerait à une tache, pas à une ombre portée.
 */
function shadowFor(elevation: NonNullable<PlayingCardProps['elevation']>, w: number) {
  const r = (value: number) => Math.round(value * 10) / 10;
  switch (elevation) {
    case 'none':
      return 'none';
    case 'rest':
      return `0 ${r(w * 0.012)}px ${r(w * 0.025)}px rgb(0 0 0 / 0.3), 0 ${r(w * 0.07)}px ${r(w * 0.15)}px -${r(w * 0.06)}px rgb(0 0 0 / 0.5)`;
    case 'lift':
      return `0 ${r(w * 0.02)}px ${r(w * 0.04)}px rgb(0 0 0 / 0.26), 0 ${r(w * 0.2)}px ${r(w * 0.36)}px -${r(w * 0.12)}px rgb(0 0 0 / 0.6)`;
    case 'fly':
      return `0 ${r(w * 0.06)}px ${r(w * 0.13)}px rgb(0 0 0 / 0.3), 0 ${r(w * 0.3)}px ${r(w * 0.5)}px -${r(w * 0.16)}px rgb(0 0 0 / 0.58)`;
  }
}

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
  lite = false,
  style,
}: PlayingCardProps) {
  return (
    <div
      className={`relative overflow-hidden no-select ${className ?? ''}`}
      style={{
        width,
        height: width / CARD_RATIO,
        borderRadius: `${(18 / 250) * 100}%`,
        boxShadow: shadowFor(elevation, width),
        background: faceDown || !card ? '#081a27' : '#fbfaf5',
        ...style,
      }}
    >
      {faceDown || !card ? (
        lite ? (
          <CardBackLite width={width} />
        ) : (
          <CardBack />
        )
      ) : (
        <CardFace card={card} dimmed={dimmed} />
      )}
    </div>
  );
}

export const PlayingCard = memo(PlayingCardBase);
