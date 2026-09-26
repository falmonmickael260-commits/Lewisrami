'use client';

import { motion } from 'framer-motion';
import type { PlayerView } from '@/game/view';
import { ROLE_META } from './roles';

/**
 * Récapitulatif de l'échange au centre de la table : qui donne quoi à qui,
 * et ce qu'il reste à faire. Les cartes voyagent en parallèle via la couche de vol.
 */
export function ExchangePanel({ view }: { view: PlayerView }) {
  const transfers = view.exchange?.transfers ?? [];
  if (transfers.length === 0) return null;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '…';
  const roleOf = (id: string) => {
    const role = view.players.find((p) => p.id === id)?.role;
    return role ? ROLE_META[role].icon : '·';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="panel pointer-events-none w-[min(19rem,86vw)] rounded-2xl px-4 py-3"
      style={{ background: 'rgba(5,24,18,0.93)' }}
      role="status"
      aria-live="polite"
    >
      <p className="mb-2 text-center text-[0.62rem] font-bold uppercase tracking-[0.24em] text-gold-500/80">
        Échange des cartes
      </p>
      <ul className="flex flex-col gap-1.5">
        {transfers.map((transfer, index) => (
          <motion.li
            key={`${transfer.fromId}-${transfer.toId}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.08 }}
            className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-[0.78rem] ${
              transfer.done ? 'bg-emerald-400/10 text-cream/70' : 'bg-white/[0.05] text-cream/85'
            }`}
          >
            <span className="shrink-0">{roleOf(transfer.fromId)}</span>
            <span className="min-w-0 flex-1 truncate">{nameOf(transfer.fromId)}</span>
            <span className="shrink-0 text-gold-400/80">
              → {transfer.count}
            </span>
            <span className="min-w-0 flex-1 truncate text-right">{nameOf(transfer.toId)}</span>
            <span className="shrink-0">{roleOf(transfer.toId)}</span>
            <span className="w-4 shrink-0 text-center text-[0.72rem]">
              {transfer.done ? '✓' : '…'}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
