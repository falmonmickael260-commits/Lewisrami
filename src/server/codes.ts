export { normalizeRoomCode } from '@/lib/roomCode';

/** Alphabet sans caractères ambigus (0/O, 1/I/L) : un code dicté à l'oral reste fiable. */
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY2346789';

export function generateRoomCode(length = 4): string {
  let code = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function generatePlayerId(): string {
  return `pl_${crypto.randomUUID().slice(0, 8)}`;
}
