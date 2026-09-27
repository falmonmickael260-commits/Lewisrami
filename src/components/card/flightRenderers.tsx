import type { Card } from '@/game/types';
import type { RamiCard } from '@/rami/types';
import type { FlightCardRenderer } from '@/components/game/FlightLayer';
import { PlayingCard } from './PlayingCard';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';

/**
 * Rendus des cartes en vol, un par jeu.
 *
 * Ce sont des constantes de module, et non des fonctions recréées à chaque
 * rendu : la couche de vol mémoïse ses cartes, une nouvelle référence à chaque
 * frame annulerait cette mémoïsation.
 */

export const presidentFlightCard: FlightCardRenderer<Card> = (card, width) => (
  <PlayingCard
    card={card ?? undefined}
    faceDown={!card}
    lite={!card}
    width={width}
    elevation="fly"
  />
);

export const ramiFlightCard: FlightCardRenderer<RamiCard> = (card, width) => (
  <RamiPlayingCard
    card={card ?? undefined}
    faceDown={!card}
    lite={!card}
    width={width}
    elevation="fly"
  />
);
