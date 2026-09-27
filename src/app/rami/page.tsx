import type { Metadata } from 'next';
import { RamiHome } from '@/components/rami/RamiHome';

export const metadata: Metadata = {
  title: 'Rami — jeu de cartes multijoueur en ligne',
  description:
    'Le Rami en multijoueur temps réel : 1 vs 1, 1 vs 1 vs 1 ou 2 vs 2, 108 cartes, jokers, ouverture à 71 points. Créez une salle et partagez le code.',
};

export default function Page() {
  return <RamiHome />;
}
