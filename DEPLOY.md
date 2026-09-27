# Déployer les jeux de cartes

Une seule application sert les deux jeux : le **Rami** (`/rami`) et le
**Président** (`/president`), avec une page de choix à la racine.

## Contrainte d'architecture à connaître

Le serveur Next.js **détient l'état des parties en mémoire** et pousse les mises
à jour à chaque joueur par SSE. Il doit donc tourner en **un seul processus
persistant**.

| Hébergeur | Compatible | Pourquoi |
| --- | --- | --- |
| Render, Railway, Fly.io, VPS, Docker | ✅ | Un conteneur qui tourne en continu |
| Vercel, Netlify, Cloudflare Pages | ❌ | Fonctions serverless : chaque requête peut tomber sur une instance différente, la salle disparaîtrait d'un coup à l'autre, et les flux SSE y sont limités dans le temps |

Si un déploiement Vercel est indispensable, il faut au préalable déplacer
l'état et la diffusion vers un service partagé (Postgres + Realtime, ou
Durable Objects) — ce n'est pas une variable d'environnement à changer, c'est
une réécriture de `src/server/roomStore.ts`, partagé par les deux jeux.

---

## Option 1 — Render (la plus simple, aucun jeton à créer)

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint**
2. Choisir le dépôt `falmonmickael260-commits/presidente` et la branche à
   déployer
3. Render lit `render.yaml`, construit le `Dockerfile` et déploie
4. (Optionnel) Onglet **Environment** → ajouter les deux variables Supabase

Render se connecte à GitHub par OAuth : il n'y a pas de jeton à copier.

## Option 2 — Fly.io

```bash
fly auth login          # ouvre le navigateur
fly launch --no-deploy  # lit fly.toml
fly secrets set NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

## Option 3 — Docker, n'importe où

```bash
docker build -t jeux-de-cartes .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  jeux-de-cartes
```

## Option 4 — sans conteneur

```bash
npm ci && npm run build && npm start
```

---

## Supabase (optionnel)

Sans Supabase, **le jeu fonctionne** : les salles vivent en mémoire. Avec
Supabase, elles survivent à un redémarrage ou à un redéploiement.

### 1. Appliquer le schéma

Dashboard → **SQL Editor** → **New query** → coller le contenu de
[`supabase/schema.sql`](supabase/schema.sql) → **Run**.

### 2. Récupérer les clés

Dashboard → **Project Settings** (roue dentée, en bas à gauche) → **API**.

| Champ affiché | Variable | Nature |
| --- | --- | --- |
| `Project URL` | `NEXT_PUBLIC_SUPABASE_URL` | public |
| `anon` / `public` (parfois « Publishable key ») | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public |
| `service_role` / `secret` (cliquer sur « Reveal ») | `SUPABASE_SERVICE_ROLE_KEY` | **secret** |

### 3. Les renseigner

Dans l'onglet « Environment » / « Secrets » de l'hébergeur — **jamais** dans le
dépôt.

> ⚠️ La clé `service_role` contourne toutes les règles RLS. Elle ne doit jamais
> se retrouver dans le navigateur, dans un commit, ni dans une conversation.
> Si elle a fuité : Dashboard → Project Settings → API → **Generate new key**.

Les tables `president_rooms` et `rami_rooms` contiennent les mains des joueurs :
le schéma fourni active RLS sans aucune policy publique, elles sont donc
inaccessibles depuis le navigateur. Seul le serveur y accède, avec la clé
`service_role`.

> Une installation antérieure stockait les salles du Président dans une table
> `rooms`. Le schéma la recopie automatiquement vers `president_rooms` : il n'y
> a rien à faire de plus.
