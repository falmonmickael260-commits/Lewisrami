'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MODE_LABELS } from '@/rami/scoring';
import type { RamiPlayerView } from '@/rami/view';
import { Button } from '@/components/ui/Button';
import { teamName, teamStyle } from './theme';

interface GameOverSheetProps {
  open: boolean;
  view: RamiPlayerView;
  onRestart: () => void;
  canRestart: boolean;
  onLeave: () => void;
}

/**
 * Fin de partie.
 *
 * Le Rami se gagne **par le bas** : l'équipe qui atteint la cible perd. On dit
 * donc explicitement qui gagne et qui a franchi la barre, pour éviter toute
 * lecture à l'envers du tableau.
 */
export function GameOverSheet({
  open,
  view,
  onRestart,
  canRestart,
  onLeave,
}: GameOverSheetProps) {
  const outcome = view.outcome;
  if (!outcome) return null;

  const me = view.players.find((player) => player.id === view.youId) ?? null;
  const iWon = me?.teamId === outcome.winnerTeamId;
  const ranking = view.teams.slice().sort((a, b) => a.score - b.score);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="absolute inset-0 bg-ink-950/88 backdrop-blur-md" />

          {/* Gerbe de lumière : discrète, et jamais au détriment de la lisibilité. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{
              background: iWon
                ? 'radial-gradient(60% 45% at 50% 22%, rgba(236,208,138,0.22), transparent 70%)'
                : 'radial-gradient(60% 45% at 50% 22%, rgba(103,217,208,0.14), transparent 70%)',
            }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Fin de partie"
            className="panel relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl px-5 pb-7 pt-6 sm:max-w-xl sm:rounded-3xl sm:px-8"
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <header className="mb-5 text-center">
              <motion.p
                className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-gold-500/70"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                Rami · {MODE_LABELS[view.settings.mode]} · {outcome.rounds} manche
                {outcome.rounds > 1 ? 's' : ''}
              </motion.p>
              <motion.h2
                className="text-gradient-gold font-display text-4xl sm:text-5xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.16, type: 'spring', stiffness: 300, damping: 22 }}
              >
                {iWon ? 'Victoire' : 'Partie terminée'}
              </motion.h2>
              <motion.p
                className="mt-1.5 text-[0.86rem] text-cream/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {teamName(outcome.winnerTeamId, view.settings.mode, view.players)} l’emporte avec
                le score le plus bas.
              </motion.p>
            </header>

            <div className="grid gap-2">
              {ranking.map((team, index) => {
                const style = teamStyle(team.id);
                const lost = outcome.loserTeamIds.includes(team.id);
                const won = team.id === outcome.winnerTeamId;
                const members = view.players.filter((player) => player.teamId === team.id);
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.34 + index * 0.1, type: 'spring', stiffness: 300, damping: 28 }}
                    className="flex items-center gap-3 rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: won
                        ? 'rgba(236,208,138,0.55)'
                        : lost
                          ? 'rgba(242,96,106,0.45)'
                          : style.border,
                      background: won
                        ? 'linear-gradient(160deg, rgba(236,208,138,0.16), rgba(236,208,138,0.02))'
                        : style.surface,
                    }}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {won ? '🏆' : lost ? '💥' : '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.92rem] font-semibold text-cream">
                        {teamName(team.id, view.settings.mode, view.players)}
                      </p>
                      <p className="truncate text-[0.68rem] text-cream/45">
                        {members.map((player) => `${player.avatar} ${player.name}`).join(' · ')}
                      </p>
                    </div>
                    <span
                      className={`text-2xl font-bold tabular-nums ${
                        lost ? 'text-ruby-400' : 'text-cream'
                      }`}
                    >
                      {team.score}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-[0.7rem] text-cream/50">
                Cible : <span className="font-semibold text-cream/80">{view.settings.targetScore}</span>{' '}
                points. La première équipe à l’atteindre perd la partie.
              </p>
            </motion.div>

            <motion.div
              className="mt-5 flex flex-col gap-2 sm:flex-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {canRestart ? (
                <Button variant="primary" block onClick={onRestart}>
                  Rejouer avec la même table
                </Button>
              ) : (
                <p className="flex-1 self-center text-center text-[0.74rem] text-cream/45">
                  L’hôte peut relancer une partie.
                </p>
              )}
              <Button variant="secondary" onClick={onLeave}>
                Quitter
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
