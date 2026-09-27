export interface StoredSession {
  code: string;
  token: string;
  playerId: string;
}

export interface Identity {
  name: string;
  avatar: string;
}

/**
 * Les deux jeux cohabitent dans la même application : les sessions sont donc
 * cloisonnées par jeu, sinon un code de salle commun ferait passer le jeton
 * d'une table du Président pour celui d'une table de Rami.
 */
export type GameNamespace = 'president' | 'rami';

const sessionKey = (game: GameNamespace, code: string) => `${game}:session:${code}`;
/** L'identité (pseudo, avatar) est volontairement commune aux deux jeux. */
const IDENTITY_KEY = 'joueur:identite';
const LEGACY_IDENTITY_KEY = 'president:identity';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* navigation privée : la session reste en mémoire uniquement */
  }
}

/** La session d'une salle survit à un rafraîchissement : c'est la clé de la reconnexion. */
export function loadSession(code: string, game: GameNamespace = 'president'): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = safeGet(sessionKey(game, code));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token && parsed.playerId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession, game: GameNamespace = 'president') {
  if (typeof window === 'undefined') return;
  safeSet(sessionKey(game, session.code), JSON.stringify(session));
}

export function clearSession(code: string, game: GameNamespace = 'president') {
  try {
    window.localStorage.removeItem(sessionKey(game, code));
  } catch {
    /* ignoré */
  }
}

export function loadIdentity(): Identity | null {
  if (typeof window === 'undefined') return null;
  const raw = safeGet(IDENTITY_KEY) ?? safeGet(LEGACY_IDENTITY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Identity;
    return parsed.name ? parsed : null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity) {
  if (typeof window === 'undefined') return;
  safeSet(IDENTITY_KEY, JSON.stringify(identity));
}
