'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { PlayerView, PublicPlayer } from '@/game/view';
import { Button } from '@/components/ui/Button';
import { positionLabel } from './roles';

interface RoundResultsProps {
  view: PlayerView;
  isHost: boolean;
  onNextRound: () => void;
  onRestart: () => void;
  skew: number;
  reducedMotion: boolean;
}

const MEDALS = ['👑', '🥈', '🥉'];

/** Le dernier reçoit toujours le 💩, quelle que soit la taille de la table. */
function rankIcon(index: number, total: number, fallback: string): string {
  if (index === 0) return MEDALS[0];
  if (index === total - 1) return '💩';
  return MEDALS[index] ?? fallback;
}

function ordered(view: PlayerView): PublicPlayer[] {
  const byId = new Map(view.players.map((p) => [p.id, p]));
  if (view.phase === 'game_over') {
    return view.players.slice().sort((a, b) => b.score - a.score);
  }
  return view.finishOrder
    .map((id) => byId.get(id))
    .filter((p): p is PublicPlayer => Boolean(p));
}

function useCountdown(deadline: number | null, skew: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (deadline === null) return;
    const update = () => setLeft(Math.max(0, Math.ceil((deadline - (Date.now() + skew)) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [deadline, skew]);
  return left;
}

/**
 * Séquence de fin de manche : les joueurs apparaissent dans leur ordre d'arrivée,
 * le Président en premier et avec la plus forte emphase.
 */
export function RoundResults({
  view,
  isHost,
  onNextRound,
  onRestart,
  skew,
  reducedMotion,
}: RoundResultsProps) {
  const isFinal = view.phase === 'game_over';
  const list = ordered(view);
  const countdown = useCountdown(view.phaseEndsAt, skew);
  const total = view.players.length;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[65] flex items-center justify-center px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <motion.div
          className="absolute inset-0 bg-ink-950/82 backdrop-blur-[10px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="panel relative w-full max-w-md overflow-hidden rounded-3xl px-5 py-6 sm:max-w-lg sm:px-8 sm:py-8"
          initial={{ y: 26, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          <div className="mb-5 text-center">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.3em] text-gold-500/80">
              {isFinal ? 'Partie terminée' : `Manche ${view.roundNumber} / ${view.settings.rounds}`}
            </p>
            <h2 className="text-gradient-gold mt-1 font-display text-4xl sm:text-5xl">
              {isFinal ? 'Classement final' : 'Résultats'}
            </h2>
            <div className="gold-rule mx-auto mt-3 h-px w-32" />
          </div>

          <ol className="flex flex-col gap-2">
            {list.map((player, index) => {
              const isTop = index === 0;
              return (
                <motion.li
                  key={player.id}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -28, scale: 0.94 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{
                    delay: reducedMotion ? 0 : 0.18 + index * 0.16,
                    type: 'spring',
                    stiffness: 300,
                    damping: 24,
                  }}
                  className={[
                    'relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5',
                    isTop
                      ? 'border-gold-500/45 bg-[linear-gradient(100deg,rgba(236,208,138,0.18),rgba(236,208,138,0.03))]'
                      : index === list.length - 1
                        ? 'border-amber-800/35 bg-amber-950/25'
                        : 'border-white/10 bg-white/[0.04]',
                  ].join(' ')}
                >
                  {isTop && !reducedMotion && (
                    <motion.span
                      className="pointer-events-none absolute inset-y-0 -left-24 w-24 skew-x-[-18deg] bg-white/18"
                      initial={{ x: 0 }}
                      animate={{ x: 520 }}
                      transition={{ delay: 0.5, duration: 1.1, ease: 'easeOut' }}
                    />
                  )}
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-950/60 text-lg">
                    {rankIcon(index, list.length, player.avatar)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[0.95rem] font-semibold ${
                        isTop ? 'text-gold-300' : 'text-cream/90'
                      }`}
                    >
                      {player.name}
                      {player.id === view.youId && (
                        <span className="ml-1.5 text-[0.7rem] text-cream/50">vous</span>
                      )}
                    </p>
                    <p className="truncate text-[0.68rem] uppercase tracking-[0.12em] text-cream/45">
                      {isFinal ? `${player.score} points` : positionLabel(index, total)}
                    </p>
                  </div>
                  {!isFinal && (
                    <span className="shrink-0 rounded-full bg-white/8 px-2.5 py-1 text-[0.7rem] font-bold tabular-nums text-cream/70">
                      +{total - index}
                    </span>
                  )}
                </motion.li>
              );
            })}
          </ol>

          {!isFinal && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-5 text-center text-[0.74rem] text-cream/50"
            >
              Échange des cartes puis nouvelle manche
              {countdown > 0 && ` dans ${countdown} s`}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-4 flex justify-center"
          >
            {isFinal ? (
              isHost ? (
                <Button variant="primary" size="lg" onClick={onRestart}>
                  Nouvelle partie
                </Button>
              ) : (
                <p className="text-[0.78rem] text-cream/50">
                  L’hôte peut relancer une partie.
                </p>
              )
            ) : isHost ? (
              <Button variant="primary" size="lg" onClick={onNextRound}>
                Manche suivante
              </Button>
            ) : null}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
