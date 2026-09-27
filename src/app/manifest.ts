import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jeux de cartes en ligne — Rami et Le Président',
    short_name: 'Jeux de cartes',
    description:
      'Le Rami et Le Président en multijoueur temps réel : tables premium, cartes vectorielles et règles complètes.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#04140f',
    theme_color: '#04140f',
    lang: 'fr',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
