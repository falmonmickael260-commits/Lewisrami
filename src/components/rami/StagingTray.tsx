'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { RamiPlayingCard } from '@/components/ramicard/RamiPlayingCard';
import type { StagedGroup } from '@/hooks/useRamiTurn';

interface StagingTrayProps {
  groups: StagedGroup[];
  total: number;
  /** Points minimum exigés, `null` si le joueur est déjà entré. */
  required: number | null;
  hasRun: boolean;
  requiresRun: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
}

/**
 * Plan de travail des combinaisons préparées.
 *
 * Une ouverture demande souvent plusieurs combinaisons comptées **ensemble**
 * (71 points). Plutôt que de deviner, le joueur les empile ici, voit le total
 * monter, et ne pose que lorsque le compte y est — exactement comme on aligne
 * ses cartes devant soi sur une vraie table.
 */
export function StagingTray({
  groups,
  total,
  required,
  hasRun,
  requiresRun,
  onRemove,
  onClear,
}: StagingTrayProps) {
  if (groups.length === 0) return null;

  const enough = required === null || total >= required;
  const runOk = !requiresRun || hasRun;
  const ready = enough && runOk;
  const progress = required && required > 0 ? Math.min(1, total / required) : 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="panel rounded-2xl px-3 py-2.5"
      aria-label="Combinaisons préparées"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-cream/50">
          À poser
        </span>
        <span className="h-px flex-1 bg-white/8" aria-hidden="true" />
        <span
          className={`text-[0.78rem] font-bold tabular-nums ${ready ? 'text-emerald-300' : 'text-gold-300'}`}
        >
          {total} pts
          {required !== null && required > 0 && (
            <span className="text-cream/35"> / {required}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-2 py-0.5 text-[0.66rem] font-semibold text-cream/45 transition hover:bg-white/10 hover:text-cream"
        >
          Tout reprendre
        </button>
      </div>

      {required !== null && required > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: ready
                ? 'linear-gradient(90deg,#5fd8a4,#9ff0c8)'
                : 'linear-gradient(90deg,#b8903f,#ecd08a)',
            }}
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <AnimatePresence initial={false}>
          {groups.map((group) => (
            <motion.div
              key={group.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="shrink-0 rounded-xl border border-emerald-300/25 bg-emerald-400/8 px-2 pb-1.5 pt-1"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-emerald-200">
                  {group.label}
                  {group.qualifiesRun && ' ✓'}
                </span>
                <span className="text-[0.58rem] tabular-nums text-cream/45">
                  {group.points} pts
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(group.id)}
                  aria-label={`Reprendre ${group.label.toLowerCase()}`}
                  className="ml-auto grid h-4 w-4 place-items-center rounded-full bg-white/10 text-[0.6rem] text-cream/60 transition hover:bg-ruby-500/40 hover:text-cream"
                >
                  ✕
                </button>
              </div>
              <div className="relative" style={{ height: 40, width: 22 * group.cards.length + 8 }}>
                {group.cards.map((card, index) => (
                  <div
                    key={card.id}
                    className="absolute top-0"
                    style={{ left: index * 22, zIndex: index }}
                  >
                    <RamiPlayingCard card={card} width={29} elevation="none" />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!runOk && (
        <p className="mt-1.5 text-[0.66rem] font-semibold text-gold-300">
          Il manque une tierce de trois vraies cartes.
        </p>
      )}
    </motion.div>
  );
}
