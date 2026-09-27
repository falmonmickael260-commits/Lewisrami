import type { Metadata } from 'next';
import { HomeScreen } from '@/components/home/HomeScreen';

export const metadata: Metadata = {
  title: 'Le Président — jeu de cartes en ligne',
  description:
    'Le Président en multijoueur temps réel : 3 à 8 joueurs, table premium, animations de cartes et règles officielles. Créez une salle et partagez le code.',
};

export default function Page() {
  return <HomeScreen />;
}
