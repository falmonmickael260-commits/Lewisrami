import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Le Président — jeu de cartes en ligne',
    short_name: 'Le Président',
    description:
      'Le Président en multijoueur temps réel : 3 à 8 joueurs, table premium et règles officielles.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#04140f',
    theme_color: '#04140f',
    lang: 'fr',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
