import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rami — jeu de cartes multijoueur en ligne',
    short_name: 'Rami',
    description:
      'Le Rami en multijoueur temps réel : table premium, cartes vectorielles et règles complètes.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#04140f',
    theme_color: '#04140f',
    lang: 'fr',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
