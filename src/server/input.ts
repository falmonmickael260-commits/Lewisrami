/** Validation défensive des entrées client : rien n'est supposé de confiance. */

import { AVATARS } from '@/lib/avatars';
import { CARD_ID_PATTERN } from '@/rami/cards';
import { PLAYERS_BY_MODE } from '@/rami/scoring';
import type { GameMode, MeldProposal, RamiRank, Suit } from '@/rami/types';

const NAME_MAX = 16;
const ALLOWED_AVATARS: readonly string[] = AVATARS;

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
  return cleaned.length >= 2 ? cleaned : null;
}

export function sanitizeAvatar(raw: unknown): string {
  if (typeof raw === 'string' && ALLOWED_AVATARS.includes(raw)) return raw;
  return ALLOWED_AVATARS[Math.floor(Math.random() * ALLOWED_AVATARS.length)];
}

export function sanitizeCardIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > 4) return null;
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !/^(?:[3-9]|1[0-5])[SHDC]$/.test(item)) return null;
    ids.push(item);
  }
  return Array.from(new Set(ids)).length === ids.length ? ids : null;
}

export function sanitizeSettings(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Record<string, unknown>;
  const out: { turnSeconds?: number; rounds?: number; allowEqualRank?: boolean } = {};
  if (typeof value.turnSeconds === 'number' && Number.isFinite(value.turnSeconds)) {
    out.turnSeconds = value.turnSeconds;
  }
  if (typeof value.rounds === 'number' && Number.isFinite(value.rounds)) {
    out.rounds = value.rounds;
  }
  if (typeof value.allowEqualRank === 'boolean') out.allowEqualRank = value.allowEqualRank;
  return out;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/* ------------------------------------------------------------------ */
/* Rami                                                               */
/* ------------------------------------------------------------------ */

/** Une combinaison compte au plus 14 cartes (une tierce de l'As à l'As). */
const MELD_MAX_CARDS = 14;
/** On ne pose jamais plus de cinq combinaisons d'un coup avec 15 cartes. */
const MELDS_MAX = 5;
const MODES = Object.keys(PLAYERS_BY_MODE) as GameMode[];
const SUIT_CODES: readonly string[] = ['S', 'H', 'D', 'C'];

/** Identifiants de cartes du Rami : `12S_0`, `X_3`. */
export function sanitizeRamiCardIds(raw: unknown, max = MELD_MAX_CARDS): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > max) return null;
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !CARD_ID_PATTERN.test(item)) return null;
    ids.push(item);
  }
  return new Set(ids).size === ids.length ? ids : null;
}

export function sanitizeMeldId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : null;
}

/**
 * Combinaisons proposées par un client.
 *
 * On ne valide ici que la **forme** : c'est le moteur qui décide si la
 * combinaison est licite, si le joueur possède les cartes et si le seuil
 * d'ouverture est atteint.
 */
export function sanitizeMeldProposals(raw: unknown): MeldProposal[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > MELDS_MAX) return null;

  const out: MeldProposal[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const entry = item as Record<string, unknown>;

    if (entry.kind !== 'run' && entry.kind !== 'set') return null;
    const cardIds = sanitizeRamiCardIds(entry.cardIds);
    if (!cardIds || cardIds.length < 3) return null;
    for (const id of cardIds) {
      if (seen.has(id)) return null;
      seen.add(id);
    }

    const proposal: MeldProposal = { kind: entry.kind, cardIds };

    if (entry.jokerRank !== undefined) {
      const rank = Number(entry.jokerRank);
      if (!Number.isInteger(rank) || rank < 1 || rank > 13) return null;
      proposal.jokerRank = rank as RamiRank;
    }
    if (entry.jokerSuit !== undefined) {
      if (typeof entry.jokerSuit !== 'string' || !SUIT_CODES.includes(entry.jokerSuit)) {
        return null;
      }
      proposal.jokerSuit = entry.jokerSuit as Suit;
    }

    out.push(proposal);
  }

  return out;
}

export function sanitizeRamiSettings(raw: unknown): { mode?: GameMode; turnSeconds?: number } {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Record<string, unknown>;
  const out: { mode?: GameMode; turnSeconds?: number } = {};

  if (typeof value.mode === 'string' && MODES.includes(value.mode as GameMode)) {
    out.mode = value.mode as GameMode;
  }
  if (typeof value.turnSeconds === 'number' && Number.isFinite(value.turnSeconds)) {
    out.turnSeconds = Math.min(180, Math.max(15, Math.round(value.turnSeconds)));
  }
  return out;
}
