'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { PublicPlayer } from '@/game/view';
import { CARD_RATIO } from '@/components/card/geometry';
import { useAnchors, anchorKeys } from './Anchors';
import { ROLE_META } from './roles';
import { TurnTimer } from './TurnTimer';

interface PlayerSeatProps {
  player: PublicPlayer;
  isCurrent: boolean;
  isYou: boolean;
  hasLead: boolean;
  deadline: number | null;
  totalMs: number;
  skew: number;
  compact: boolean;
  /** Version resserrée pour les tables nombreuses sur petit écran. */
  dense?: boolean;
  /** Compteur affiché pendant la distribution, le temps que les cartes arrivent. */
  cardCountOverride?: number;
}

/** Éventail réduit de dos de cartes : lecture immédiate du nombre de cartes restantes. */
function MiniFan({ count, width }: { count: number; width: number }) {
  const shown = Math.min(count, 5);
  const height = width / CARD_RATIO;
  return (
    <div
      className="relative"
      style={{ width: width + (shown - 1) * width * 0.34, height }}
      aria-hidden="true"
    >
      {Array.from({ length: shown }).map((_, index) => (
        <div
          key={index}
          className="absolute top-0 rounded-[14%] border border-gold-500/25 bg-[linear-gradient(140deg,#123a52,#081a27)] shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)]"
          style={{
            width,
            height,
            left: index * width * 0.34,
            transform: `rotate(${(index - (shown - 1) / 2) * 5}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function PlayerSeatBase({
  player,
  isCurrent,
  isYou,
  hasLead,
  deadline,
  totalMs,
  skew,
  compact,
  dense = false,
  cardCountOverride,
}: PlayerSeatProps) {
  const { bind } = useAnchors();
  const cardCount = cardCountOverride ?? player.cardCount;
  const avatarSize = dense ? 38 : compact ? 46 : 58;
  const role = player.role ? ROLE_META[player.role] : null;
  const isOut = player.finishPosition !== null;

  return (
    <motion.div
      layout
      className={
        dense
          ? 'flex w-[74px] flex-col items-center gap-1'
          : 'flex w-[104px] flex-col items-center gap-1.5 sm:w-[132px]'
      }
      animate={{
        scale: isCurrent ? 1.06 : 1,
        opacity: isOut ? 0.55 : player.connected ? 1 : 0.62,
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      <div className="relative" style={{ width: avatarSize, height: avatarSize }}>
        {/* Halo du joueur actif : repère principal de « qui joue ». */}
        <AnimatePresence>
          {isCurrent && (
            <motion.span
              className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(95,216,164,0.4),transparent_70%)]"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0.45, 0.8, 0.45], scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ opacity: { duration: 2.4, repeat: Infinity }, scale: { duration: 0.3 } }}
            />
          )}
        </AnimatePresence>

        <div
          ref={bind(anchorKeys.seat(player.id))}
          className={[
            'relative grid h-full w-full place-items-center rounded-full border text-2xl',
            'bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.14),rgba(6,32,24,0.9))]',
            isCurrent ? 'border-emerald-300/70' : 'border-white/14',
            'shadow-[0_10px_26px_-12px_rgba(0,0,0,0.9)]',
          ].join(' ')}
        >
          <span className="translate-y-[1px] no-select" style={{ fontSize: avatarSize * 0.5 }}>
            {player.avatar}
          </span>
          {hasLead && (
            <span
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-gold-400 text-[0.6rem] text-ink-950 shadow"
              title="A la main"
            >
              ★
            </span>
          )}
        </div>

        {isCurrent && deadline !== null && (
          <TurnTimer
            deadline={deadline}
            totalMs={totalMs}
            skew={skew}
            size={avatarSize + 14}
            alert={isYou}
          />
        )}
      </div>

      <div className="flex max-w-full flex-col items-center gap-0.5">
        <span
          className={`max-w-full truncate ${
            dense ? 'text-[0.68rem]' : 'text-[0.78rem]'
          } font-semibold ${isCurrent ? 'text-cream' : 'text-cream/75'}`}
        >
          {player.name}
          {isYou && <span className="ml-1 text-gold-400/80">(vous)</span>}
        </span>
        {role && !isOut && (
          <span className={`text-[0.62rem] uppercase tracking-[0.12em] ${role.tone}`}>
            {dense ? role.icon : `${role.icon} ${role.label}`}
          </span>
        )}
      </div>

      <div className={`flex items-center justify-center ${dense ? 'min-h-[18px]' : 'min-h-[26px]'}`}>
        {isOut ? (
          <span className="rounded-full border border-gold-500/30 bg-gold-500/12 px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-gold-300">
            {player.finishPosition === 0 ? '👑 1ᵉʳ' : `${(player.finishPosition ?? 0) + 1}ᵉ`}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {!dense && <MiniFan count={cardCount} width={compact ? 16 : 20} />}
            <span
              className={
                dense
                  ? 'rounded-full bg-ink-950/70 px-2 py-0.5 text-[0.66rem] font-bold tabular-nums text-cream/75'
                  : 'text-[0.72rem] font-semibold tabular-nums text-cream/70'
              }
            >
              {dense ? `🂠 ${cardCount}` : cardCount}
            </span>
          </div>
        )}
      </div>

      <div className={`flex items-center gap-1 ${dense ? 'h-3.5' : 'h-4'}`}>
        <AnimatePresence>
          {player.passed && !isOut && (
            <motion.span
              key="passed"
              initial={{ opacity: 0, y: -4, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="rounded-full bg-ink-900/80 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-cream/55"
            >
              Passe
            </motion.span>
          )}
          {!player.connected && !player.isBot && (
            <motion.span
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-full bg-ruby-600/25 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ruby-400"
            >
              Hors ligne
            </motion.span>
          )}
          {player.isBot && !dense && (
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-cream/45">
              Bot
            </span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export const PlayerSeat = memo(PlayerSeatBase);
