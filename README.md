# 🃏 Jeux de cartes en ligne — Rami & Le Président

Deux véritables tables de jeu numériques, multijoueur en temps réel, serveur
autoritaire, cartes entièrement vectorielles et motion design soigné.

Aucun compte, aucune installation : on crée une salle, on partage un code de
4 caractères, et on joue.

| Jeu | Joueurs | Objectif | Accueil |
| --- | --- | --- | --- |
| **Rami** | 2 à 4 (1v1 · 1v1v1 · 2v2) | Ne pas atteindre 401 / 601 points | `/rami` |
| **Le Président** | 3 à 8 | Se débarrasser de ses cartes | `/president` |

La racine `/` propose le choix du jeu.

---

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
```

Rien d'autre à configurer. Le serveur Next.js héberge l'état des parties en
mémoire et diffuse les mises à jour en temps réel.

```bash
npm run verify       # typecheck + tests + build
npm run test         # moteurs de règles (Vitest)
npm run build && npm start
```

### Jouer seul pour essayer

Depuis le salon, l'hôte peut **ajouter des bots**. Ils passent par les mêmes
actions et la même validation que les joueurs humains : ils ne voient jamais
que leur propre main.

---

## Le Rami

La variante implémentée est décrite intégralement — exemples compris — dans
[**REGLES-RAMI.md**](REGLES-RAMI.md), qui fait référence. En résumé :

| Sujet | Règle |
| --- | --- |
| Paquet | 2 jeux de 52 cartes + 4 jokers = **108 cartes** |
| Distribution | 14 cartes, **15 au donneur** — il ne pioche pas et jette sa quinzième |
| Tour | Piocher ou reprendre la défausse → poser → **jeter** (obligatoire) |
| Reprise | Une carte reprise dans la défausse **doit servir immédiatement** |
| Tierce | 3 cartes consécutives ou plus, même signe |
| Brelan / carré | 3 ou 4 cartes de même valeur, signes différents |
| Jokers | **1 par combinaison**, compté à la valeur de la carte représentée |
| Ouverture | **71 points**, dont une tierce de **trois vraies cartes** |
| Surenchère | L'équipe suivante doit dépasser : 71 → 72, 119 → 120 |
| Partenaire | En 2 vs 2, il lui suffit d'une tierce |
| Joker dans une tierce | Se récupère avec **la carte exacte** |
| Joker dans un brelan | Se récupère avec **toutes** les cartes manquantes |
| Table | On ne réorganise jamais : on **complète** seulement |
| Fin de manche | Il faut **toujours** une carte à jeter |
| Score | Gagnant **0** · jamais posé **100** · sinon les cartes restantes |
| Cible | 401 en 1 vs 1, 601 sinon — **l'atteindre fait perdre** |

Les points d'interprétation assumés — ce que le cahier des charges ne tranchait
pas — sont listés à la fin de `REGLES-RAMI.md`, avec l'endroit du code où les
modifier.

## Le Président

| Sujet | Règle |
| --- | --- |
| Paquet | 52 cartes, ordre 3 … A, **2** |
| Combinaisons | 1 à 4 cartes de même valeur |
| Ouverture | Manche 1 : le porteur de la **Dame de pique** commence |
| Carré | Ferme le pli immédiatement |
| Classement | 👑 Président · 🥈 Vice-Président · … · 💩 Trou du Cul |
| Échange | Trou du Cul → Président : 2 meilleures cartes, retour au choix |

---

## Architecture

```
src/
├─ rami/            Moteur du Rami — pur, sans React, réseau ni DOM
│  ├─ cards.ts      108 cartes, valeurs, As 1/11, tri
│  ├─ melds.ts      Tierces, brelans, carrés, jokers, compléments
│  ├─ scoring.ts    Seuils d'ouverture, points de manche, fin de partie
│  ├─ moves.ts      Validation centrale, messages destinés au joueur
│  ├─ engine.ts     Machine d'état (distribution → tours → manches)
│  ├─ solver.ts     Recherche de combinaisons (bots + aide d'interface)
│  ├─ view.ts       Projection par joueur (frontière de confidentialité)
│  ├─ bot.ts        Stratégie des bots
│  └─ *.test.ts     Tous les cas du cahier des charges
│
├─ game/            Moteur du Président (même principes)
│
├─ server/
│  ├─ roomStore.ts  Plomberie des salles, **commune aux deux jeux**
│  ├─ games/        Un adaptateur par jeu
│  ├─ persistence.ts  Supabase optionnel, une table par jeu
│  └─ input.ts      Validation défensive des entrées client
│
├─ app/
│  ├─ page.tsx           Choix du jeu
│  ├─ rami/ …            Accueil, salle, règlement
│  ├─ president/ salle/  Accueil et salle du Président
│  └─ api/               REST + flux SSE, un espace par jeu
│
├─ components/
│  ├─ card/         Cartes du Président, géométrie et éventail partagés
│  ├─ ramicard/     Faces du Rami (As → Roi) et joker vectoriel
│  ├─ rami/         Table, tapis, main, plan de travail, règlement
│  ├─ game/         Table du Président, ancres, couche de vol
│  └─ ui/ lobby/ home/
│
└─ hooks/
   ├─ useGameRoom      Connexion temps réel, commune aux deux jeux
   ├─ useRamiTurn      Sélection, préparation des combinaisons
   └─ useRamiDirector  Événements serveur → trajectoires, sons, annonces
```

### Ce qui est partagé, et ce qui ne l'est pas

Les deux jeux **partagent** la plomberie : salles, jetons, présence, chrono,
bots, flux temps réel, géométrie des cartes, calcul de l'éventail, couche de
vol, composants d'interface de base.

Ils ne partagent **aucune règle** : les valeurs, l'ordre et les combinaisons
diffèrent, et les mélanger produirait des cartes illisibles. La couche de vol
est donc générique sur le type de carte, et chaque jeu fournit son rendu.

### Le serveur fait autorité

- Chaque action est **revalidée** côté serveur, quoi que prétende le client.
- Un joueur ne reçoit que **sa propre main**. Les autres sont réduits à
  `{ pseudo, avatar, nombre de cartes, statut }`, et la pioche à un compteur.
- Seule la carte du dessus de la défausse est publique — comme sur une vraie
  table.
- Le chrono tourne côté serveur : à l'expiration, un tour complet est joué
  automatiquement (remise éventuelle, pioche, défausse).
- Le jeton d'identité n'accorde aucun droit : il ne fait qu'identifier.

### Temps réel

Le flux passe par **SSE**. À chaque mutation, le serveur pousse à chaque abonné
une vue *personnalisée* plus la liste des événements à animer.

Ce choix est délibéré : chaque joueur doit recevoir un état **différent**.
Diffuser les lignes brutes d'une table — via Supabase Realtime par exemple —
exposerait les mains adverses à tous les abonnés du canal.

La reconnexion est triviale : le client garde son jeton en `localStorage`,
`EventSource` se reconnecte avec un repli exponentiel, et la première vue reçue
fait autorité. Rafraîchir la page, changer de réseau ou mettre le téléphone en
veille ne fait pas perdre la partie.

### Supabase (optionnel)

Les jeux fonctionnent sans. En configurant les variables ci-dessous, les salles
survivent à un redémarrage du serveur :

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Appliquez alors `supabase/schema.sql`. Les tables restent inaccessibles depuis
le navigateur (RLS sans policy publique) : elles contiennent les mains.

---

## Qualité visuelle

- **Aucun asset bitmap.** Cartes, enseignes, figures, jokers et dos sont des SVG
  paramétriques : ils restent nets sur mobile, Retina, 2K et 4K, à toute échelle
  et pendant les animations.
- Le joker est dessiné en symétrie centrale, comme une vraie carte : bonnet à
  grelots repris à 180°, et le mot JOKER le long des deux bords.
- Les figures (V / D / R) utilisent une composition héraldique plutôt qu'un
  personnage détaillé : à 55 px de large dans une main éventaillée, un visage
  dessiné devient illisible alors qu'un monogramme reste parfaitement lisible.
- Le grain du tapis est généré par `feTurbulence`, pas par une image.
- L'éventail calcule la largeur réellement balayée par les cartes inclinées :
  aucune carte n'est jamais rognée, de 320 px à 4K.

## Interface du Rami

Le point délicat est l'**ouverture** : il faut souvent plusieurs combinaisons
comptées ensemble pour atteindre 71 points. Plutôt que de le deviner, le joueur
les prépare sur un plan de travail, voit le total monter, et ne pose que
lorsque le compte y est — comme on aligne ses cartes devant soi sur une vraie
table.

Le solveur propose une ouverture quand il en trouve une, mais ne l'impose
jamais : c'est un bouton, pas un coup joué.

## Motion design

Chaque animation sert la lisibilité :

- **Distribution** : les cartes partent de la pioche, une par une, vers chaque joueur.
- **Pioche** : l'arrivée dans l'éventail démarre exactement de la pioche ou de
  la défausse, selon l'origine réelle de la carte.
- **Pose et complément** : les cartes quittent la main, suivent un arc, tournent
  et s'intègrent à la combinaison. Une carte en vol est masquée à destination :
  elle n'y apparaît qu'une fois arrivée.
- **Joker** : la carte de remplacement part vers la table, le joker revient vers
  la main, avec annonce et retour haptique.
- **Fin de manche** : le décompte se dévoile ligne par ligne, avec le détail.

`prefers-reduced-motion` est respecté : les trajectoires sont remplacées par des
fondus courts, sans jamais désactiver de fonctionnalité.

## Accessibilité

- Chaque carte est un bouton avec un libellé lisible (« sept de cœur,
  sélectionnée »).
- Les états ne reposent jamais uniquement sur la couleur : le chrono ajoute une
  pulsation, une équipe porte un nom en plus de sa teinte, une combinaison
  jouable annonce « Compléter ici ».
- Raccourcis clavier au Rami : `P` piocher, `R` reprendre la défausse, `Entrée`
  préparer/poser/jeter, `Échap` annuler, `T` trier la main par signe ou par
  valeur. Ils sont listés dans le menu de la partie.
- Contrastes renforcés sous `prefers-contrast: more`.

## Performance

Toutes les animations portent sur `transform` et `opacity`. Le chrono s'écrit
directement dans le DOM en `requestAnimationFrame` : aucun rendu React par
frame. Le solveur est borné par un budget de nœuds : une main tordue ne peut
pas faire tourner le serveur en rond.

---

## Déploiement

Voir [DEPLOY.md](DEPLOY.md). En résumé : le serveur doit tourner en **un seul
processus persistant** (Render, Fly.io, Railway, Docker) — les plateformes
serverless ne conviennent ni à l'état en mémoire ni aux flux SSE.

## Licence

Projet privé.
