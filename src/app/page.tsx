import type { Metadata } from 'next';
import { GameHub } from '@/components/home/GameHub';

export const metadata: Metadata = {
  title: 'Jeux de cartes en ligne — Rami et Le Président',
  description:
    'Deux jeux de cartes multijoueur en temps réel : le Rami (2 à 4 joueurs, jokers, ouverture à 71) et le Président (3 à 8 joueurs). Sans compte, sans installation.',
};

export default function Page() {
  return <GameHub />;
}
