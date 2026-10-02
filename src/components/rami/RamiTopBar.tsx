'use client';

import { motion } from 'framer-motion';
import type { RamiPlayerView } from '@/rami/view';
import { MODE_LABELS } from '@/rami/scoring';
import type { ConnectionStatus } from '@/hooks/useGameRoom';
import { PHASE_LABELS, teamName, teamStyle } from './theme';

interface RamiTopBarProps {
  view: RamiPlayerView;
  status: ConnectionStatus;
  onRules: () => void;
  onMenu: () => void;
}

/**
 * Bandeau supérieur : où en est la partie, et où en sont les équipes.
 *
 * Les scores du Rami se lisent à l'envers — **atteindre la cible fait perdre**.
 * On affiche donc le score et la cible ensemble, et la barre se remplit vers le
 * danger, pas vers la victoire.
 */
export function RamiTopBar({ view, status, onRules, onMenu }: RamiTopBarProps) {
  const me = view.players.find((player) => player.id === view.youId) ?? null;

  return (
    <header className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-40 px-2.5">
      <div className="panel pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl px-2.5 py-1.5">
        <div className="flex min-w-0 shrink-0 flex-col leading-tight">
          <span className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-gold-500/70">
            Rami 71 · {MODE_LABELS[view.settings.mode]}
          </span>
          <span className="truncate text-[0.74rem] font-semibold text-cream/80">
            {view.roundNumber > 0 ? `Manche ${view.roundNumber}` : PHASE_LABELS[view.phase]}
            {view.phase !== 'playing' && view.roundNumber > 0 && (
              <span className="text-cream/45"> · {PHASE_LABELS[view.phase]}</span>
            )}
          </span>
        </div>

        <div className="order-last flex w-full min-w-0 items-center gap-1.5 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
          {view.teams.map((team) => {
            const style = teamStyle(team.id);
            const mine = me?.teamId === team.id;
            const ratio = Math.min(1, team.score / view.settings.targetScore);
            return (
              <div
                key={team.id}
                className={`flex shrink-0 flex-col gap-0.5 rounded-xl border px-2 py-1 ${
                  mine ? 'bg-white/[0.07]' : 'bg-ink-950/30'
                }`}
                style={{ borderColor: mine ? style.border : 'rgba(255,255,255,0.08)' }}
                title={`${teamName(team.id, view.settings.mode, view.players)} — ${team.score} points sur ${view.settings.targetScore}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: style.accent }}
                    aria-hidden="true"
                  />
                  <span className="max-w-[6.5rem] truncate text-[0.6rem] font-semibold text-cream/65">
                    {teamName(team.id, view.settings.mode, view.players)}
                  </span>
                  <span className="text-[0.72rem] font-bold tabular-nums text-cream">
                    {team.score}
                  </span>
                  {team.opening.opened && (
                    <span
                      className="rounded-full bg-emerald-400/15 px-1 text-[0.5rem] font-bold uppercase tracking-wider text-emerald-300"
                      title={`Ouverture réalisée à ${team.opening.score} points`}
                    >
                      {team.opening.score}
                    </span>
                  )}
                </div>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        ratio > 0.8
                          ? 'linear-gradient(90deg,#a51f34,#f2606a)'
                          : `linear-gradient(90deg, ${style.accent}55, ${style.accent})`,
                    }}
                    initial={false}
                    animate={{ width: `${ratio * 100}%` }}
                    transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          {status !== 'live' && (
            <span
              className="rounded-full bg-ruby-500/20 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-ruby-400"
              role="status"
            >
              {status === 'reconnecting' ? 'reconnexion' : status === 'gone' ? 'fermée' : '…'}
            </span>
          )}
          <button
            type="button"
            onClick={onRules}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/8 text-[0.8rem] text-cream/70 transition hover:bg-white/16 hover:text-cream"
            aria-label="Règlement du Rami"
            title="Règlement"
          >
            ?
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/8 text-[0.8rem] text-cream/70 transition hover:bg-white/16 hover:text-cream"
            aria-label="Menu de la partie"
          >
            ⋯
          </button>
        </div>
      </div>
    </header>
  );
}
