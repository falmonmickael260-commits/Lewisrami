import type { Role } from '@/game/types';

export const ROLE_META: Record<Role, { label: string; icon: string; tone: string }> = {
  president: { label: 'Président', icon: '👑', tone: 'text-gold-300' },
  vice_president: { label: 'Vice-Président', icon: '🥈', tone: 'text-slate-200' },
  neutre: { label: 'Neutre', icon: '•', tone: 'text-cream/60' },
  vice_trou: { label: 'Vice-Trou', icon: '🧻', tone: 'text-amber-200/80' },
  trou_du_cul: { label: 'Trou du Cul', icon: '💩', tone: 'text-amber-700' },
};

export function positionLabel(position: number, total: number): string {
  if (position === 0) return 'Président';
  if (position === total - 1) return 'Trou du Cul';
  if (position === 1 && total >= 4) return 'Vice-Président';
  if (position === total - 2 && total >= 4) return 'Vice-Trou du Cul';
  return `${position + 1}ᵉ`;
}
