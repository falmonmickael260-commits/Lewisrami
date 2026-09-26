'use client';

import { motion } from 'framer-motion';
import { AVATARS } from '@/lib/avatars';

export function IdentityPicker({
  name,
  avatar,
  onName,
  onAvatar,
  autoFocus = false,
}: {
  name: string;
  avatar: string;
  onName: (value: string) => void;
  onAvatar: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cream/45">
          Votre pseudo
        </span>
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          maxLength={16}
          autoFocus={autoFocus}
          autoComplete="nickname"
          placeholder="Ex. Camille"
          className="h-12 rounded-2xl border border-white/12 bg-ink-950/45 px-4 text-[1rem] text-cream placeholder:text-cream/25 transition focus:border-gold-500/50 focus:bg-ink-950/70 focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cream/45">
          Avatar
        </span>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATARS.map((emoji) => (
            <motion.button
              key={emoji}
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => onAvatar(emoji)}
              aria-label={`Choisir l’avatar ${emoji}`}
              aria-pressed={avatar === emoji}
              className={`grid aspect-square place-items-center rounded-xl border text-xl transition ${
                avatar === emoji
                  ? 'border-gold-400/70 bg-gold-500/15 shadow-[0_0_18px_-6px_rgba(236,208,138,0.7)]'
                  : 'border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <span className="no-select">{emoji}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
