'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { Notice } from '@/hooks/useDirector';

const TONES: Record<Notice['tone'], string> = {
  neutral: 'border-white/14 bg-ink-900/85 text-cream/85',
  good: 'border-gold-500/40 bg-[rgba(24,20,8,0.9)] text-gold-300',
  warn: 'border-ruby-400/40 bg-[rgba(32,10,14,0.9)] text-ruby-400',
};

/** Fil d'événements discret : lisible sans masquer la table. */
export function Notices({ notices }: { notices: Notice[] }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.5rem)] z-50 flex flex-col items-center gap-1.5 px-4"
      role="log"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {notices.map((notice) => (
          <motion.div
            key={notice.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`rounded-full border px-4 py-1.5 text-[0.76rem] font-semibold shadow-[0_12px_30px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md ${TONES[notice.tone]}`}
          >
            {notice.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
