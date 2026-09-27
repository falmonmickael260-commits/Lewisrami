'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useMemo } from 'react';
import { cardsFromSpec } from '@/rami/notation';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import { PlayingCard } from '@/components/card/PlayingCard';
import { parseCardId } from '@/game/cards';
import type { Card } from '@/game/types';

interface GameEntry {
  href: string;
  eyebrow: string;
  title: string;
  pitch: string;
  facts: string[];
  accent: string;
  preview: React.ReactNode;
}

/**
 * Choix du jeu.
 *
 * Les deux jeux partagent le même moteur de salles, les mêmes cartes
 * vectorielles et le même soin de finition : on les présente donc côte à côte,
 * avec un aperçu réel plutôt qu'une vignette.
 */
export function GameHub() {
  const ramiCards = useMemo(() => cardsFromSpec('H6 H7 X H9'), []);
  const presidentCards = useMemo(
    () =>
      ['12S', '12H', '12D']
        .map((id) => parseCardId(id))
        .filter((card): card is Card => card !== null),
    [],
  );

  const games: GameEntry[] = [
    {
      href: '/rami',
      eyebrow: '2 à 4 joueurs',
      title: 'Rami',
      pitch:
        'Tierces, brelans et carrés. Ouvrez à 71 points, complétez la table, et récupérez les jokers de vos adversaires.',
      facts: ['108 cartes', '1v1 · 1v1v1 · 2v2', 'Jokers'],
      accent: 'rgba(236,208,138,0.4)',
      preview: (
        <div className="flex">
          {ramiCards.map((card, index) => (
            <div key={card.id} style={{ marginLeft: index === 0 ? 0 : -30 }}>
              <RamiPlayingCard card={card} width={72} elevation="lift" />
            </div>
          ))}
        </div>
      ),
    },
    {
      href: '/president',
      eyebrow: '3 à 8 joueurs',
      title: 'Le Président',
      pitch:
        'Débarrassez-vous de vos cartes avant les autres. Carrés fermants, échanges entre Président et Trou du Cul.',
      facts: ['52 cartes', '3 à 8 joueurs', 'Carrés'],
      accent: 'rgba(103,217,208,0.4)',
      preview: (
        <div className="flex">
          {presidentCards.map((card, index) => (
            <div key={card.id} style={{ marginLeft: index === 0 ? 0 : -30 }}>
              <PlayingCard card={card} width={72} elevation="lift" />
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <main className="felt-surface felt-grain min-h-dvh w-full">
      {/* Sur un très grand écran, la mise en page respire au lieu de se
          recroqueviller au centre : tout grandit avec la fenêtre. */}
      <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-7 px-5 py-10 2xl:max-w-5xl 2xl:gap-10">
        <header className="text-center">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-gold-500/70"
          >
            Sans compte · Sans installation
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="text-gradient-gold font-display text-5xl leading-tight sm:text-6xl 2xl:text-8xl"
          >
            Jeux de cartes en ligne
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="mx-auto mt-2 max-w-md text-[0.9rem] leading-relaxed text-cream/55 2xl:max-w-xl 2xl:text-[1.05rem]"
          >
            Créez une table, partagez un code de quatre lettres, et jouez en temps réel depuis
            n’importe quel écran.
          </motion.p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((game, index) => (
            <motion.div
              key={game.href}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1 + index * 0.12,
                type: 'spring',
                stiffness: 260,
                damping: 26,
              }}
            >
              <Link href={game.href} className="group block h-full">
                <motion.article
                  whileHover={{ y: -6 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="panel flex h-full flex-col gap-4 rounded-3xl p-5 transition-colors 2xl:gap-6 2xl:p-8"
                  style={{ borderColor: game.accent }}
                >
                  <div className="flex h-24 items-center justify-center overflow-hidden 2xl:h-40">
                    <motion.div
                      className="will-animate 2xl:scale-150"
                      whileHover={{ rotate: -3, scale: 1.05 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    >
                      {game.preview}
                    </motion.div>
                  </div>

                  <div className="flex-1">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-gold-500/70">
                      {game.eyebrow}
                    </p>
                    <h2 className="text-gradient-gold font-display text-3xl 2xl:text-5xl">
                      {game.title}
                    </h2>
                    <p className="mt-1.5 text-[0.82rem] leading-relaxed text-cream/55 2xl:text-base">
                      {game.pitch}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {game.facts.map((fact) => (
                      <span
                        key={fact}
                        className="rounded-full border border-white/12 bg-white/6 px-2.5 py-1 text-[0.66rem] font-semibold text-cream/60"
                      >
                        {fact}
                      </span>
                    ))}
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-[0.82rem] font-semibold text-gold-300 transition group-hover:gap-2.5">
                    Jouer <span aria-hidden="true">→</span>
                  </span>
                </motion.article>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-[0.74rem] text-cream/35">
          <Link href="/rami/regles" className="transition hover:text-cream/70">
            Règlement du Rami
          </Link>
        </p>
      </div>
    </main>
  );
}
