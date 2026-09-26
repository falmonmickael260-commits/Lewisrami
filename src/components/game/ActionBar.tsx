'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface ActionBarProps {
  isYourTurn: boolean;
  statusText: string;
  /** Description de la combinaison sélectionnée, ou raison du refus. */
  selectionText: string | null;
  selectionValid: boolean;
  primaryLabel: string;
  canPlay: boolean;
  canPass: boolean;
  onPlay: () => void;
  onPass: () => void;
  onClear: () => void;
  hasSelection: boolean;
  /** Masque « Passer » là où l'action n'a aucun sens (phase d'échange). */
  showPass: boolean;
  /** Pastille du joueur local (avatar + chrono), rendue à gauche du statut. */
  badge: React.ReactNode;
}

/**
 * Barre d'action.
 * Sur mobile, les boutons occupent leur propre ligne pleine largeur : ils
 * restent atteignables au pouce et le texte de statut n'est jamais tronqué.
 */
export function ActionBar({
  isYourTurn,
  statusText,
  selectionText,
  selectionValid,
  primaryLabel,
  canPlay,
  canPass,
  onPlay,
  onPass,
  onClear,
  hasSelection,
  showPass,
  badge,
}: ActionBarProps) {
  const buttons = (
    <>
      <AnimatePresence initial={false}>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, width: 0 }}
            animate={{ opacity: 1, scale: 1, width: 'auto' }}
            exit={{ opacity: 0, scale: 0.85, width: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <Button
              size="md"
              variant="secondary"
              onClick={onClear}
              aria-label="Annuler la sélection"
              className="!px-3.5"
            >
              ✕
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {showPass && (
        <Button
          size="md"
          variant="secondary"
          onClick={onPass}
          disabled={!canPass}
          className="flex-1 sm:flex-none"
        >
          Passer
        </Button>
      )}
      {/* Une seule impulsion quand le coup devient jouable. Une pulsation en
          boucle rendrait la cible mouvante sous le pouce — et n'apporterait
          rien une fois l'attention captée. */}
      <motion.div
        className="flex-[1.3] sm:flex-none"
        variants={{
          idle: { scale: 1 },
          ready: { scale: [1, 1.045, 1] },
        }}
        initial={false}
        animate={canPlay ? 'ready' : 'idle'}
        transition={{ duration: 0.42, ease: 'easeOut' }}
      >
        <Button size="md" variant="primary" onClick={onPlay} disabled={!canPlay} block>
          {primaryLabel}
        </Button>
      </motion.div>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-3">
      <div className="flex items-center gap-2.5">
        {badge}
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <motion.p
            key={statusText}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={`truncate text-[0.84rem] font-semibold tracking-tight sm:text-[0.94rem] ${
              isYourTurn ? 'text-gold-300' : 'text-cream/60'
            }`}
          >
            {statusText}
          </motion.p>
          <div className="h-[1.1rem]">
            <AnimatePresence mode="wait">
              {selectionText && (
                <motion.p
                  key={selectionText}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={`truncate text-[0.74rem] ${
                    selectionValid ? 'text-emerald-300/90' : 'text-ruby-400/90'
                  }`}
                >
                  {selectionText}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">{buttons}</div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 sm:hidden">{buttons}</div>
    </div>
  );
}
