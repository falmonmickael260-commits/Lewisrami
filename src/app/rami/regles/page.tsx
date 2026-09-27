import type { Metadata } from 'next';
import Link from 'next/link';
import { RamiRules } from '@/components/rami/RamiRules';

export const metadata: Metadata = {
  title: 'Règlement du Rami',
  description:
    'Toutes les règles du Rami : modes, distribution, tierces, brelans, carrés, jokers, ouverture à 71 points, score et fin de manche.',
};

/** Le règlement en page autonome : partageable par lien, indexable. */
export default function Page() {
  return (
    <main className="felt-surface felt-grain min-h-dvh w-full">
      <div className="pt-safe pb-safe mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
        <header className="text-center">
          <Link
            href="/rami"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cream/45 transition hover:text-cream"
          >
            ← Rami
          </Link>
          <h1 className="text-gradient-gold mt-2 font-display text-4xl sm:text-5xl">
            Règlement du Rami
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[0.86rem] leading-relaxed text-cream/55">
            La variante jouée ici, illustrée avec les cartes du jeu.
          </p>
        </header>
        <RamiRules />
      </div>
    </main>
  );
}
