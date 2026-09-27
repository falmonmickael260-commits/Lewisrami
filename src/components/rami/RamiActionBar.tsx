'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { shortLabel } from '@/rami/cards';
import type { RamiCard } from '@/rami/types';
import { Button } from '@/components/ui/Button';
import type { StatusLine } from './status';

export interface RamiActionBarProps {
  status: StatusLine;
  /** Écran bas : on se passe de la ligne d'explication. */
  dense?: boolean;
  /** Aide contextuelle sur la sélection en cours. */
  selectionHint: { valid: boolean; text: string | null };
  busy: boolean;

  canDrawStock: boolean;
  canTakeDiscard: boolean;
  discardTop: RamiCard | null;
  onDrawStock: () => void;
  onTakeDiscard: () => void;

  canCancelTake: boolean;
  onCancelTake: () => void;

  canGroup: boolean;
  onGroup: () => void;

  canLay: boolean;
  layPoints: number;
  layHint: string | null;
  onLay: () => void;

  suggestion: { points: number } | null;
  onSuggest: () => void;

  canDiscard: boolean;
  onDiscard: () => void;

  hasSelection: boolean;
  onClearSelection: () => void;
}

const TONES = {
  idle: 'text-cream/70',
  you: 'text-gold-300',
  urgent: 'text-ruby-400',
} as const;

/**
 * Barre d'action : ce que le joueur peut faire, maintenant.
 *
 * Seuls les boutons réellement jouables apparaissent. Un bouton grisé qui ne
 * dit pas pourquoi il l'est ne sert à personne — on préfère un message clair.
 */
export function RamiActionBar({
  status,
  dense = false,
  selectionHint,
  busy,
  canDrawStock,
  canTakeDiscard,
  discardTop,
  onDrawStock,
  onTakeDiscard,
  canCancelTake,
  onCancelTake,
  canGroup,
  onGroup,
  canLay,
  layPoints,
  layHint,
  onLay,
  suggestion,
  onSuggest,
  canDiscard,
  onDiscard,
  hasSelection,
  onClearSelection,
}: RamiActionBarProps) {
  const hint = layHint ?? selectionHint.text;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-[2.1rem] flex-col items-center gap-0.5 text-center">
        <motion.p
          key={status.title}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className={`text-[0.9rem] font-bold tracking-tight ${TONES[status.tone]}`}
          role="status"
        >
          {status.title}
        </motion.p>
        <AnimatePresence mode="wait" initial={false}>
          {(hint ?? (dense ? null : status.detail)) && (
            <motion.p
              key={hint ?? status.detail ?? ''}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={`max-w-xl text-[0.72rem] leading-snug ${
                hint && !selectionHint.valid ? 'text-ruby-400/90' : 'text-cream/50'
              }`}
            >
              {hint ?? status.detail}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {canDrawStock && (
          <Button variant="primary" size="md" onClick={onDrawStock} disabled={busy}>
            Piocher
          </Button>
        )}
        {canTakeDiscard && discardTop && (
          <Button variant="secondary" size="md" onClick={onTakeDiscard} disabled={busy}>
            Reprendre {shortLabel(discardTop)}
          </Button>
        )}

        {canCancelTake && (
          <Button variant="danger" size="md" onClick={onCancelTake} disabled={busy}>
            Remettre la carte
          </Button>
        )}

        {canGroup && (
          <Button variant="secondary" size="md" onClick={onGroup} disabled={busy}>
            Préparer la combinaison
          </Button>
        )}

        {canLay && (
          <Button variant="primary" size="md" onClick={onLay} disabled={busy}>
            Poser · {layPoints} pts
          </Button>
        )}

        {suggestion && (
          <Button variant="ghost" size="md" onClick={onSuggest} disabled={busy}>
            💡 Proposition · {suggestion.points} pts
          </Button>
        )}

        {canDiscard && (
          <Button variant="primary" size="md" onClick={onDiscard} disabled={busy}>
            Jeter
          </Button>
        )}

        {hasSelection && (
          <Button variant="ghost" size="sm" onClick={onClearSelection} disabled={busy}>
            Désélectionner
          </Button>
        )}
      </div>
    </div>
  );
}
