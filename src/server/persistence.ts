/**
 * Persistance optionnelle sur Supabase (PostgREST).
 *
 * Le serveur reste la **source de vérité** : Supabase ne sert qu'à faire survivre
 * les salles à un redémarrage. La diffusion temps réel passe par SSE et non par
 * Supabase Realtime, car chaque joueur doit recevoir une vue *différente* — sa
 * main uniquement. Diffuser des lignes brutes exposerait toutes les mains aux
 * abonnés du canal.
 *
 * Aucune configuration n'est requise : sans variables d'environnement, tout est
 * neutralisé et le jeu fonctionne en mémoire.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Clé **secrète** uniquement.
 *
 * Les tables contiennent les mains des joueurs : le schéma active RLS sans
 * aucune policy publique. Une clé publique (`anon` / `publishable`) verrait
 * donc toutes ses requêtes refusées — et, pire, l'autoriser exposerait les
 * mains à quiconque lit le code du navigateur. On refuse explicitement plutôt
 * que d'échouer en silence à chaque écriture.
 *
 * Supabase a renommé ses clés : `service_role` est devenue `sb_secret_…`.
 * Les deux noms de variable sont acceptés.
 */
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const publicKeyOnly =
  !key &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

if (url && publicKeyOnly) {
  console.warn(
    '[persistance] Supabase est configuré avec une clé publique : la persistance reste ' +
      'désactivée. Renseignez SUPABASE_SECRET_KEY (clé « secret » / « service_role »).',
  );
}

export const persistenceEnabled = Boolean(url && key);

export interface Persistence<S> {
  enabled: boolean;
  save(code: string, state: S, tokens: Record<string, string>): Promise<void>;
  load(code: string): Promise<{ state: S; tokens: Record<string, string> } | null>;
  remove(code: string): Promise<void>;
}

interface RoomRow<S> {
  code: string;
  state: S;
  tokens: Record<string, string> | null;
}

function headers(): HeadersInit {
  return {
    apikey: key as string,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
}

/**
 * Persistance d'une table donnée. Chaque jeu a la sienne : `president_rooms`,
 * `rami_rooms`. Aucune n'est lisible depuis le navigateur — elles contiennent
 * les mains (RLS active, sans policy publique).
 */
export function createPersistence<S>(table: string): Persistence<S> {
  if (!persistenceEnabled) {
    return {
      enabled: false,
      async save() {},
      async load() {
        return null;
      },
      async remove() {},
    };
  }

  return {
    enabled: true,

    async save(code, state, tokens) {
      try {
        await fetch(`${url}/rest/v1/${table}?on_conflict=code`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify([
            { code, state, tokens, updated_at: new Date().toISOString() },
          ]),
          cache: 'no-store',
        });
      } catch {
        // La persistance est un confort : une panne réseau n'interrompt jamais une partie.
      }
    },

    async load(code) {
      // Un raté réseau ici mime une salle disparue pour de bon : après un
      // redémarrage du serveur, c'est justement le moment où l'on a le plus
      // besoin que cette lecture réussisse. Une seconde tentative absorbe un
      // aléa isolé sans changer le comportement quand Supabase est réellement
      // injoignable.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(
            `${url}/rest/v1/${table}?code=eq.${encodeURIComponent(code)}&select=code,state,tokens&limit=1`,
            { headers: headers(), cache: 'no-store' },
          );
          if (!response.ok) {
            if (attempt === 0) continue;
            return null;
          }
          const rows = (await response.json()) as RoomRow<S>[];
          const row = rows[0];
          if (!row) return null;
          return { state: row.state, tokens: row.tokens ?? {} };
        } catch {
          if (attempt === 0) continue;
          return null;
        }
      }
      return null;
    },

    async remove(code) {
      try {
        await fetch(`${url}/rest/v1/${table}?code=eq.${encodeURIComponent(code)}`, {
          method: 'DELETE',
          headers: headers(),
          cache: 'no-store',
        });
      } catch {
        /* ignoré volontairement */
      }
    },
  };
}
