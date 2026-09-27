'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { NEVER_MELDED_POINTS } from '@/rami/cards';
import type { RamiPlayerView } from '@/rami/view';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import { Button } from '@/components/ui/Button';
import { teamName, teamStyle } from './theme';

interface RoundSummarySheetProps {
  open: boolean;
  view: RamiPlayerView;
  onNextRound: () => void;
  onClose: () => void;
  canAdvance: boolean;
}

/**
 * Fin de manche.
 *
 * On montre le **calcul**, pas seulement le résultat : qui a gagné, ce que
 * chacun avait encore en main, et pourquoi il marque ce qu'il marque. Un score
 * de Rami sans son détail est une source de disputes.
 */
export function RoundSummarySheet({
  open,
  view,
  onNextRound,
  onClose,
  canAdvance,
}: RoundSummarySheetProps) {
  const summary = view.lastSummary;
  if (!summary) return null;

  const winner = view.players.find((player) => player.id === summary.winnerId);
  const nameOf = (playerId: string) =>
    view.players.find((player) => player.id === playerId)?.name ?? '—';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Résultats de la manche ${summary.roundNumber}`}
            className="panel relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl px-4 pb-6 pt-5 sm:max-w-2xl sm:rounded-3xl sm:px-7"
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

            <motion.header
              className="mb-4 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-gold-500/70">
                Manche {summary.roundNumber}
              </p>
              <h2 className="text-gradient-gold font-display text-3xl sm:text-4xl">
                {winner ? `${winner.name} termine` : 'Manche close'}
              </h2>
              {winner && (
                <p className="mt-1 text-[0.8rem] text-cream/55">
                  {view.settings.mode === '2v2'
                    ? 'Son équipe marque zéro.'
                    : 'Il marque zéro.'}
                </p>
              )}
            </motion.header>

            {/* ------------------------------------------ Score des équipes */}
            <div className="mb-4 grid gap-2">
              {summary.teams.map((team, index) => {
                const style = teamStyle(team.teamId);
                const busted = summary.bustedTeamIds.includes(team.teamId);
                return (
                  <motion.div
                    key={team.teamId}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.16 + index * 0.08, type: 'spring', stiffness: 320, damping: 28 }}
                    className="flex items-center gap-3 rounded-2xl border px-3 py-2.5"
                    style={{
                      borderColor: busted ? 'rgba(242,96,106,0.5)' : style.border,
                      background: busted
                        ? 'linear-gradient(160deg, rgba(165,31,52,0.2), rgba(165,31,52,0.04))'
                        : style.surface,
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: style.accent }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.88rem] font-semibold text-cream">
                      {teamName(team.teamId, view.settings.mode, view.players)}
                    </span>
                    <span className="shrink-0 text-[0.8rem] font-semibold tabular-nums text-cream/60">
                      +{team.points}
                    </span>
                    <motion.span
                      className={`shrink-0 text-xl font-bold tabular-nums ${
                        busted ? 'text-ruby-400' : 'text-cream'
                      }`}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.14, 1] }}
                      transition={{ delay: 0.4 + index * 0.08, duration: 0.5 }}
                    >
                      {team.total}
                    </motion.span>
                    <span className="shrink-0 text-[0.62rem] text-cream/35">
                      / {view.settings.targetScore}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* ---------------------------------------- Détail par joueur */}
            <div className="grid gap-2">
              {summary.players.map((line, index) => (
                <motion.div
                  key={line.playerId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[0.84rem] font-semibold text-cream">
                      {nameOf(line.playerId)}
                    </span>
                    {line.isWinner && (
                      <span className="rounded-full bg-emerald-400/18 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-emerald-300">
                        gagnant
                      </span>
                    )}
                    {line.neverMelded && !line.isWinner && (
                      <span className="rounded-full bg-ruby-500/18 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-ruby-400">
                        n’a jamais posé
                      </span>
                    )}
                    <span className="ml-auto text-lg font-bold tabular-nums text-cream">
                      {line.points}
                    </span>
                  </div>

                  <p className="mt-1 text-[0.68rem] text-cream/45">
                    {line.isWinner
                      ? 'Zéro point : la manche est à lui.'
                      : line.neverMelded
                        ? `${NEVER_MELDED_POINTS} points forfaitaires, quel que soit le nombre de cartes restantes.`
                        : line.remaining.length === 0
                          ? 'Aucune carte restante.'
                          : line.breakdown.join(' + ') + ` = ${line.points}`}
                  </p>

                  {line.remaining.length > 0 && !line.isWinner && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {line.remaining.map((card) => (
                        <RamiPlayingCard
                          key={card.id}
                          card={card}
                          width={30}
                          elevation="none"
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <motion.div
              className="mt-5 flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              <Button variant="ghost" onClick={onClose}>
                Voir la table
              </Button>
              {canAdvance ? (
                <Button variant="primary" block onClick={onNextRound}>
                  Manche suivante
                </Button>
              ) : (
                <p className="flex-1 self-center text-center text-[0.74rem] text-cream/45">
                  L’hôte lance la manche suivante…
                </p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
