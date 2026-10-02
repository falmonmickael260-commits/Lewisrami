import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Manrope } from 'next/font/google';
import './globals.css';

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Rami 71 — jeu de cartes multijoueur en ligne',
    template: '%s',
  },
  description:
    'Le Rami en multijoueur temps réel : 1 vs 1, 1 vs 1 vs 1 ou 2 vs 2, 108 cartes, jokers, ouverture à 71 points. Sans compte, sans installation.',
  applicationName: 'Rami 71',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Rami 71' },
  openGraph: {
    title: 'Rami 71 — jeu de cartes multijoueur en ligne',
    description:
      'Créez une table, partagez un code de quatre lettres, et jouez en temps réel depuis n’importe quel écran.',
    type: 'website',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#04140f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
