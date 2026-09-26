/** Jeu d'avatars autorisé. Toute valeur hors de cette liste est rejetée côté serveur. */
export const AVATARS = [
  '🦊', '🐺', '🐼', '🦁', '🐸', '🐙', '🦉', '🐝',
  '🦄', '🐯', '🐨', '🦖', '🐬', '🦅', '🐢', '🦋',
] as const;

export type AvatarEmoji = (typeof AVATARS)[number];
