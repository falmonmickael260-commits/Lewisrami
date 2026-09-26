/** Normalisation d'un code de salle, partagée par le client et le serveur. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
