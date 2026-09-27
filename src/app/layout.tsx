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
    default: 'Jeux de cartes en ligne — Rami et Le Président',
    template: '%s',
  },
  description:
    'Le Rami et Le Président en multijoueur temps réel : tables premium, cartes entièrement vectorielles et règles complètes. Sans compte, sans installation.',
  applicationName: 'Jeux de cartes',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jeux de cartes',
  },
  openGraph: {
    title: 'Jeux de cartes en ligne — Rami et Le Président',
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
