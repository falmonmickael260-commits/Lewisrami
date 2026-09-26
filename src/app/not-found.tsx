import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="felt-surface felt-grain grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-gold-500/70">
          Erreur 404
        </p>
        <h1 className="text-gradient-gold font-display text-5xl">Page introuvable</h1>
        <p className="max-w-sm text-[0.92rem] leading-relaxed text-cream/55">
          Cette adresse ne mène à aucune table. Retournez à l’accueil pour créer ou
          rejoindre une partie.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex h-12 items-center rounded-2xl bg-[linear-gradient(175deg,#fbeec6_0%,#ecd08a_38%,#c79a45_100%)] px-6 font-semibold text-ink-950"
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
