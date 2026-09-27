import { CARD_RATIO } from './geometry';

export interface FanSlot {
  x: number;
  y: number;
  rotate: number;
}

export interface FanLayout {
  slots: FanSlot[];
  cardWidth: number;
  cardHeight: number;
  totalWidth: number;
  lift: number;
  bottomInset: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Éventail d'une main.
 *
 * La largeur des cartes s'adapte à la place disponible sans jamais descendre
 * sous un seuil de lisibilité : au-delà, c'est le chevauchement qui augmente.
 *
 * Le calcul tient compte de la largeur **réellement balayée** par les cartes
 * inclinées, sans quoi les cartes des extrémités finiraient rognées par le bord
 * de l'écran :
 *
 * ```
 * extent(w) = w · [ 1 + (n−1)·ov + 2·sin(a)/ratio − (1 − cos(a)) ]
 * ```
 *
 * Partagé par les deux jeux : seule la taille des cartes change.
 */
export function computeFanLayout(
  count: number,
  width: number,
  options: { compact: boolean; maxCard?: number; minCard?: number },
): FanLayout {
  const maxCard = options.maxCard ?? (options.compact ? 96 : 112);
  const minCard = options.minCard ?? (options.compact ? 52 : 68);
  const padding = options.compact ? 16 : 30;
  const usable = Math.max(180, width - padding);

  // Angle total borné : au-delà, les cartes des extrémités balaient trop large.
  const angleStep = clamp(Math.min(4.6, 30 / Math.max(1, count - 1)), 1.2, 4.6);
  const maxAngle = (angleStep * Math.max(0, count - 1)) / 2;
  const rad = (maxAngle * Math.PI) / 180;

  const sweep = (2 * Math.sin(rad)) / CARD_RATIO - (1 - Math.cos(rad));
  // Sur mobile, on préfère des cartes lisibles très chevauchées à des
  // cartes minuscules toutes visibles.
  const target = options.compact ? 0.3 : 0.42;

  let overlap = target;
  let cardWidth =
    count > 1 ? usable / (1 + (count - 1) * target + sweep) : Math.min(maxCard, usable);
  cardWidth = Math.min(maxCard, cardWidth);

  if (cardWidth < minCard) cardWidth = minCard;
  if (count > 1) {
    // Plancher relevé : à 0.1 une carte ne laissait qu'un liseré de ~10 % de sa
    // largeur, insuffisant pour lire son index — même avec beaucoup de cartes,
    // une carte ne doit jamais devenir quasi invisible sous sa voisine.
    overlap = clamp((usable / cardWidth - sweep - 1) / (count - 1), 0.22, 0.5);
  }

  const step = cardWidth * overlap;
  const totalWidth = cardWidth + step * Math.max(0, count - 1);
  const lift = clamp(count * 1.1, 4, 20);
  // Une carte pivotée autour de son bord bas déborde vers le bas : on réserve
  // exactement la place nécessaire pour qu'aucune carte ne soit rognée.
  const bottomInset = (cardWidth / 2) * Math.sin(rad) + lift + 12;

  const slots: FanSlot[] = Array.from({ length: count }, (_, index) => {
    const centered = index - (count - 1) / 2;
    const normalized = count > 1 ? centered / ((count - 1) / 2) : 0;
    return {
      x: -totalWidth / 2 + cardWidth / 2 + index * step,
      y: normalized * normalized * lift,
      rotate: centered * angleStep,
    };
  });

  const cardHeight = cardWidth / CARD_RATIO;
  // Marge haute pour la carte soulevée (survol ou sélection).
  const topRoom = cardHeight * 0.26;

  return {
    slots,
    cardWidth,
    cardHeight,
    totalWidth,
    lift,
    bottomInset,
    height: cardHeight + bottomInset + topRoom,
  };
}
