'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import type { Meld } from '@/rami/types';
import type { PublicRamiPlayer } from '@/rami/view';
import type { GameMode } from '@/rami/types';
import { MeldView, type MeldAffordance } from './MeldView';
import { teamName, teamStyle } from './theme';

interface MeldsBoardProps {
  melds: Meld[];
  players: PublicRamiPlayer[];
  mode: GameMode;
  myTeamId: number | null;
  cardWidth: number;
  compact: boolean;
  affordanceFor: (meld: Meld) => MeldAffordance;
  onActivate: (meld: Meld) => void;
  freshCardIds: ReadonlySet<string>;
  hiddenCardIds: ReadonlySet<string>;
  /** Phrase affichée tant qu'aucune combinaison n'est posée. */
  emptyHint: string;
}

/**
 * Le tapis : toutes les combinaisons posées, regroupées par équipe.
 *
 * C'est le cœur visuel d'une table de Rami. On regroupe par équipe parce que
 * c'est l'information qui compte : savoir qui a ouvert, et où l'on a le droit
 * de poser. Les combinaisons de sa propre équipe passent en tête.
 */
export function MeldsBoard({
  melds,
  players,
  mode,
  myTeamId,
  cardWidth,
  compact,
  affordanceFor,
  onActivate,
  freshCardIds,
  hiddenCardIds,
  emptyHint,
}: MeldsBoardProps) {
  const groups = useMemo(() => {
    const byTeam = new Map<number, Meld[]>();
    for (const meld of melds) {
      const list = byTeam.get(meld.teamId);
      if (list) list.push(meld);
      else byTeam.set(meld.teamId, [meld]);
    }
    return Array.from(byTeam.entries())
      .map(([teamId, list]) => ({ teamId, melds: list }))
      .sort((a, b) => {
        // Son équipe d'abord : c'est là qu'on agit le plus souvent.
        if (a.teamId === myTeamId) return -1;
        if (b.teamId === myTeamId) return 1;
        return a.teamId - b.teamId;
      });
  }, [melds, myTeamId]);

  if (melds.length === 0) {
    return (
      <div className="mx-auto grid min-h-[6.5rem] w-full max-w-md place-items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.025] px-5 py-6 text-center">
        <p className="text-[0.8rem] leading-relaxed text-cream/45">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {groups.map((group) => {
          const style = teamStyle(group.teamId);
          const label = teamName(group.teamId, mode, players);
          const mine = group.teamId === myTeamId;
          return (
            <motion.section
              key={group.teamId}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              aria-label={`Combinaisons — ${label}`}
            >
              <header className="mb-1.5 flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: style.accent, boxShadow: `0 0 10px ${style.glow}` }}
                  aria-hidden="true"
                />
                <h3 className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-cream/55">
                  {label}
                  {mine && <span className="ml-1.5 text-cream/35">— vous</span>}
                </h3>
                <span className="h-px flex-1 bg-white/8" aria-hidden="true" />
                <span className="text-[0.62rem] tabular-nums text-cream/35">
                  {group.melds.length} combinaison{group.melds.length > 1 ? 's' : ''}
                </span>
              </header>

              <div className={`flex flex-wrap items-start ${compact ? 'gap-2' : 'gap-3'}`}>
                {group.melds.map((meld) => (
                  <MeldView
                    key={meld.id}
                    meld={meld}
                    cardWidth={cardWidth}
                    compact={compact}
                    affordance={affordanceFor(meld)}
                    onActivate={onActivate}
                    freshCardIds={freshCardIds}
                    hiddenCardIds={hiddenCardIds}
                    ownerLabel={
                      players.find((player) => player.id === meld.ownerId)?.name ?? label
                    }
                  />
                ))}
              </div>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
