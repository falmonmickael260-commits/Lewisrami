'use client';

import { Sheet } from '@/components/ui/Sheet';
import { RamiRules } from './RamiRules';

/** Le règlement, accessible depuis l'accueil, le salon et la table. */
export function RamiRulesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Règlement du Rami">
      <RamiRules />
    </Sheet>
  );
}
