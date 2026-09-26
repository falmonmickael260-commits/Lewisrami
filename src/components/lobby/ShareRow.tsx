'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/** Copie du code et partage natif : sur mobile, l'invitation part en un geste. */
export function ShareRow({ code }: { code: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/salle/${code}` : '';

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : url);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const share = async () => {
    const data = {
      title: 'Le Président',
      text: `Rejoins ma partie du Président — code ${code}`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* partage annulé : on retombe sur la copie */
      }
    }
    void copy('link');
  };

  return (
    <div className="flex flex-col gap-2.5">
      <button
        onClick={() => copy('code')}
        className="group relative overflow-hidden rounded-2xl border border-gold-500/25 bg-[linear-gradient(140deg,rgba(236,208,138,0.12),rgba(236,208,138,0.02))] px-5 py-4 text-center transition hover:border-gold-500/55"
        title="Copier le code"
      >
        <span className="block text-[0.64rem] font-bold uppercase tracking-[0.24em] text-gold-500/70">
          Code de la salle
        </span>
        <span className="text-gradient-gold block font-display text-5xl tracking-[0.22em] sm:text-6xl">
          {code}
        </span>
        <span className="mt-1 block text-[0.68rem] text-cream/40 group-hover:text-cream/70">
          {copied === 'code' ? 'Code copié ✓' : 'Toucher pour copier'}
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => copy('link')}>
          {copied === 'link' ? 'Lien copié ✓' : 'Copier le lien'}
        </Button>
        <Button variant="secondary" onClick={share}>
          Partager
        </Button>
      </div>
    </div>
  );
}
