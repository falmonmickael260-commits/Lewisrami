# Règles du Rami — variante de la maison

Ce document fait référence. Le moteur (`src/rami/`) l'implémente à la lettre, et
les tests (`src/rami/*.test.ts`) le vérifient cas par cas.

---

## 1. Matériel

- **2 jeux de 52 cartes + 4 jokers = 108 cartes.**
- Chaque carte existe donc en deux exemplaires, distinguables par leur
  identifiant (`7S_0` et `7S_1`).

### Valeur des cartes

| Carte | Points |
| --- | ---: |
| 2 à 10 | valeur faciale |
| Valet, Dame, Roi | 10 |
| As **en main** | 11 |
| Joker **en main** | 25 |

L'**As vaut 1 ou 11 selon sa position** :

| Situation | Valeur |
| --- | ---: |
| A-2-3 (As bas) | 1 |
| D-R-A (As haut) | 11 |
| Brelan ou carré | 11 |
| Resté en main | 11 |

Une suite ne « fait jamais le tour » : `R-A-2` n'existe pas.

---

## 2. Modes et objectif

| Mode | Joueurs | Cible |
| --- | ---: | ---: |
| 1 vs 1 | 2 | **401** |
| 1 vs 1 vs 1 | 3 | **601** |
| 2 vs 2 | 4 | **601** |

**Atteindre ou dépasser la cible fait perdre.** Le gagnant est celui — ou
l'équipe — qui a le score le plus bas.

En 2 vs 2, les partenaires sont face à face (sièges 0 et 2 contre 1 et 3).

---

## 3. Distribution

- **14 cartes** par joueur, **15 pour le donneur**.
- Le donneur **entame** : il ne pioche pas et doit jeter sa quinzième carte.
  Cette carte devient la première carte visible de la défausse.
- Le donneur change à chaque manche.

---

## 4. Le tour de jeu

1. **Prendre une carte** : au sommet de la pioche, *ou* la carte que le joueur
   précédent vient de jeter.
2. **Poser** des combinaisons, en **compléter**, récupérer un joker — facultatif.
3. **Jeter une carte.** C'est obligatoire : un tour se termine toujours par une
   défausse.

> **Une carte reprise dans la défausse doit être utilisée immédiatement**, dans
> une combinaison posée ou complétée pendant ce tour. Il est impossible de la
> prendre simplement pour la garder.

Tant que la carte reprise est encore en main et n'a pas servi, le joueur peut la
**remettre** à sa place et piocher normalement à la place.

### Pioche épuisée

La **dernière carte jetée reste visible**. Toutes les autres cartes de la
défausse sont reprises, mélangées, et deviennent la nouvelle pioche. La partie
continue.

---

## 5. Les combinaisons

### Tierce

- Au moins **3 cartes consécutives** du **même signe**.
- Se prolonge autant que possible : `♥4 ♥5 ♥6 ♥7 ♥8 ♥9 ♥10 ♥V ♥D ♥R ♥A`.

### Brelan

- Au moins **3 cartes de même valeur**, de **signes différents**.
- `♠7 ♥7 ♦7` est valide, `♠7 ♠7 ♥7` ne l'est pas.

### Carré

- Les **quatre** signes d'une même valeur : `♠7 ♥7 ♦7 ♣7`.

### Jokers

- **Un joker au maximum par combinaison.**
- Un joker posé **représente une carte précise** et prend sa valeur en points :
  un joker à la place d'un 7 vaut 7 points, à la place d'un Roi, 10 points.

---

## 6. L'ouverture

- La première équipe à ouvrir doit poser **71 points minimum**, en une seule
  fois, toutes combinaisons confondues.
- L'ouverture doit contenir une **tierce de trois vraies cartes**. Un joker ne
  peut pas remplacer l'une de ces trois cartes.
- Le joker **peut** servir à atteindre les 71 points, dans une *autre*
  combinaison que la tierce obligatoire (60 points réels + joker = 71 : valide).

### Surenchère

L'équipe suivante doit **dépasser** la meilleure ouverture déjà réalisée :

| Ouverture précédente | Seuil suivant |
| ---: | ---: |
| 71 | 72 |
| 119 | 120 |
| 150 | 151 |

Une équipe ne peut pas utiliser un joker récupéré à l'adversaire pour atteindre
son propre seuil : il faut d'abord avoir ouvert.

### Le partenaire (2 vs 2)

Si un joueur a ouvert pour son équipe, son partenaire **n'a pas à refaire 71** :
il lui suffit de poser une **tierce**.

---

## 7. Compléter la table

Une combinaison posée ne bouge plus :

- impossible de déplacer une carte déjà posée ;
- impossible de casser une combinaison ;
- impossible d'en fusionner deux ;
- impossible de les réorganiser.

On peut uniquement **compléter** : allonger une tierce par ses extrémités,
ajouter une enseigne manquante à un brelan.

Une fois que **toutes les équipes ont ouvert**, la contrainte de tierce
disparaît : on peut poser librement, compléter les combinaisons de son équipe
comme celles des adversaires, et récupérer des jokers.

---

## 8. Récupérer un joker

### Dans une tierce

Il faut la carte **exacte** que le joker représente.

Pour `♥5 ♥6 JOKER ♥8`, le joker représente le ♥7 : il faut **le ♥7**. Un 7 d'un
autre signe ne convient pas.

### Dans un brelan

Il faut apporter **toutes** les cartes manquantes.

Pour `♠8 ♥8 JOKER`, il faut **♦8 *et* ♣8**. Avec une seule carte, c'est interdit.
Le brelan devient alors un carré, et le joker revient en main.

Un joker récupéré peut être **rejoué immédiatement** ou **conservé en main**.

---

## 9. Finir une manche

> **Il faut toujours avoir une carte à jeter.**

Poser toutes ses cartes d'un coup, sans défausse, est interdit.

Exemple — main `6 · 8 · 9`, carte reprise `7` :

| Coup | Verdict |
| --- | --- |
| Poser `6-7-8`, jeter le 9 | ✅ |
| Poser `7-8-9`, jeter le 6 | ✅ |
| Poser `6-7-8-9` | ❌ — plus rien à jeter |

---

## 10. Le score

- **Gagnant de la manche : 0 point.** En 2 vs 2, les **deux** joueurs de
  l'équipe gagnante marquent 0, même si l'un d'eux a encore des cartes.
- **Perdant qui n'a jamais posé : 100 points forfaitaires**, quel que soit le
  nombre de cartes restantes.
- **Perdant qui a posé** : il compte uniquement les cartes restées dans sa main.

Exemple : `8 + Roi + As + Joker = 8 + 10 + 11 + 25 = 54 points`.

Les points s'ajoutent au cumul. Dès qu'une équipe atteint ou dépasse la cible, la
partie s'arrête : cette équipe a perdu.

---

## 11. Points d'interprétation assumés

Le cahier des charges ne tranche pas ces quelques situations. Les choix
ci-dessous sont isolés dans le code et faciles à modifier.

| Situation | Choix retenu | Où |
| --- | --- | --- |
| « 3 vraies cartes » pour la tierce d'ouverture | La tierce doit compter **au moins 3 cartes non-joker**. Une tierce de 3 cartes est donc entièrement réelle ; une tierce de 4 cartes dont un joker convient. | `qualifiesAsOpeningRun`, `melds.ts` |
| Seuil de la 3ᵉ équipe (1 vs 1 vs 1) | Il faut dépasser la **meilleure** ouverture déjà réalisée, pas seulement la précédente. | `openingRequirementFor`, `scoring.ts` |
| Ouverture en 1 vs 1 et 1 vs 1 vs 1 | Chaque joueur est sa propre équipe : les règles d'ouverture d'équipe s'appliquent telles quelles. | `teamOfSeat`, `scoring.ts` |
| Le donneur peut-il poser avant de jeter ? | Oui. « Il ne pioche pas » porte sur la pioche, pas sur les poses. | `startRound`, `engine.ts` |
| Combinaisons adverses en 1 vs 1 vs 1 | Accessibles quand **toutes** les équipes ont ouvert. | `canTouch`, `moves.ts` |
| Portée de la « tierce obligatoire » | C'est une condition d'**entrée** : elle s'applique à la première pose d'un joueur, pas à ses poses suivantes. Ce que la règle 28 ouvre une fois toutes les équipes entrées, c'est l'accès aux combinaisons **adverses**. | `openingRequirementFor`, `scoring.ts` |
| Joker posé en bout de tierce | Le moteur le place à l'extrémité **haute** quand les deux sont possibles ; le client peut imposer l'autre en précisant la carte représentée. | `placeRun`, `melds.ts` |
| Pioche vide **et** défausse non recyclable | La manche s'arrête sans gagnant : chacun compte ses cartes, personne ne marque 0. Cas de figure pratiquement impossible avec 108 cartes. | `doDiscard`, `engine.ts` |
| Reprise d'une carte finalement inutilisable | Le joueur peut la **remettre** sur la défausse tant qu'elle n'a pas servi, puis piocher. Rien n'est révélé : la carte était déjà publique. | `cancel_take`, `engine.ts` |
