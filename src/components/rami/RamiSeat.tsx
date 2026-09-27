'use client';

import { motion } from 'framer-motion';
import type { GameMode } from '@/rami/types';
import type { PublicRamiPlayer } from '@/rami/view';
import { TurnTimer } from '@/components/game/TurnTimer';
import { anchorKeys, useAnchors } from '@/components/game/Anchors';
import { teamStyle } from './theme';

interface RamiSeatProps {
  player: PublicRamiPlayer;
  mode: GameMode;
  isCurrent: boolean;
  isDealer: boolean;
  /** Partenaire du joueur local, en 2 vs 2. */
  isPartner: boolean;
  deadline: number | null;
  totalMs: number;
  clockSkew: number;
  compact?: boolean;
}

/**
 * Siège d'un adversaire.
 *
 * On affiche exactement ce dont on a besoin pour jouer : qui c'est, combien de
 * cartes il lui reste, s'il a déjà posé — donc s'il risque les 100 points — et
 * si c'est son tour. Jamais ses cartes.
 */
export function RamiSeat({
  player,
  mode,
  isCurrent,
  isDealer,
  isPartner,
  deadline,
  totalMs,
  clockSkew,
  compact = false,
}: RamiSeatProps) {
  const { bind } = useAnchors();
  const style = teamStyle(player.teamId);
  const size = compact ? 40 : 48;

  return (
    <motion.div
      ref={bind(anchorKeys.seat(player.id))}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30 }}
      className={[
        'relative flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 backdrop-blur-md transition-colors',
        isCurrent ? 'bg-white/[0.09]' : 'bg-ink-950/45',
      ].join(' ')}
      style={{
        borderColor: isCurrent ? style.accent : 'rgba(255,255,255,0.1)',
        boxShadow: isCurrent ? `0 0 24px -8px ${style.glow}` : undefined,
      }}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className={`grid h-full w-full place-items-center rounded-full text-lg ${
            player.connected ? '' : 'opacity-45 grayscale'
          }`}
          style={{
            background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.16), rgba(0,0,0,0.35))`,
            border: `1px solid ${style.border}`,
          }}
        >
          <span className="no-select" aria-hidden="true">
            {player.avatar}
          </span>
        </div>
        {isCurrent && deadline !== null && (
          <TurnTimer
            deadline={deadline}
            totalMs={totalMs}
            skew={clockSkew}
            size={size}
          />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[0.8rem] font-semibold ${
              player.connected ? 'text-cream' : 'text-cream/45'
            }`}
          >
            {player.name}
          </span>
          {isDealer && (
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold-500/25 text-[0.55rem] font-bold text-gold-300"
              title="Donneur de la manche"
              aria-label="donneur"
            >
              D
            </span>
          )}
          {mode === '2v2' && isPartner && (
            <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[0.55rem] font-bold uppercase tracking-wider text-cream/60">
              partenaire
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[0.64rem] text-cream/50">
          <span className="tabular-nums">
            🂠 {player.cardCount}
          </span>
          <span
            className={player.hasEntered ? 'text-emerald-300/80' : 'text-ruby-400/75'}
            title={
              player.hasEntered
                ? 'A posé : il ne compte que ses cartes restantes'
                : 'N’a pas encore posé : 100 points forfaitaires s’il perd'
            }
          >
            {player.hasEntered ? 'a posé' : 'pas ouvert'}
          </span>
          {!player.connected && <span className="text-ruby-400/80">hors ligne</span>}
        </div>
      </div>
    </motion.div>
  );
}
