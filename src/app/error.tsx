'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="felt-surface felt-grain grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-gradient-gold font-display text-5xl">Un imprévu à la table</h1>
        <p className="max-w-sm text-[0.92rem] leading-relaxed text-cream/55">
          Une erreur inattendue s’est produite. Votre partie est conservée côté serveur :
          réessayez, vous devriez la retrouver telle que vous l’avez laissée.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={reset}
            className="inline-flex h-12 items-center rounded-2xl bg-[linear-gradient(175deg,#fbeec6_0%,#ecd08a_38%,#c79a45_100%)] px-6 font-semibold text-ink-950"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex h-12 items-center rounded-2xl border border-white/14 bg-white/8 px-6 font-semibold"
          >
            Accueil
          </a>
        </div>
      </div>
    </main>
  );
}
