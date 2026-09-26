/** Jeu d'avatars autorisé. Toute valeur hors de cette liste est rejetée côté serveur. */
export const AVATARS = [
  '🦊', '🐺', '🐼', '🦁', '🐸', '🐙', '🦉', '🐝',
  '🦄', '🐯', '🐨', '🦖', '🐬', '🦅', '🐢', '🦋',
] as const;

export type AvatarEmoji = (typeof AVATARS)[number];

/** Avatar de départ tiré au sort : deux joueurs restent distinguables même
 *  s'ils ne changent rien avant de rejoindre. */
export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}
