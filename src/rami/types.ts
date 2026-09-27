/**
 * Types du domaine « Rami » (variante maison — voir REGLES-RAMI.md).
 *
 * Ce module est volontairement pur : aucune dépendance React, réseau ou DOM.
 * Toute la logique de jeu vit dans `src/rami/`, l'interface ne fait qu'afficher.
 */

/** Enseignes. Identiques au Président : les tracés SVG sont partagés. */
export type Suit = 'S' | 'H' | 'D' | 'C';

/**
 * Valeur faciale d'une carte, de l'As (1) au Roi (13).
 *
 * Contrairement au Président, l'ordre du Rami est l'ordre naturel : l'As est
 * la valeur 1, et c'est sa **position dans une suite** qui décide s'il vaut 1
 * (A-2-3) ou 11 (Q-K-A). Voir `runValueOf` dans `cards.ts`.
 */
export type RamiRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/**
 * Position d'une carte dans une suite, de 1 à 14.
 * L'As y apparaît deux fois : 1 (bas, A-2-3) et 14 (haut, Q-K-A).
 */
export type RunValue = number;

/**
 * Identifiant stable et unique d'une carte parmi les 108.
 *
 * Format : `<valeur><enseigne>_<paquet>` — par exemple `12S_0` (dame de pique
 * du premier paquet). Les jokers sont `X_0` … `X_3`.
 *
 * Le numéro de paquet fait partie de l'identifiant : les deux exemplaires
 * d'une même carte doivent rester distinguables (un brelan exige des enseignes
 * différentes, donc `7S_0` et `7S_1` ne peuvent pas cohabiter dans un brelan).
 */
export type CardId = string;

export interface RamiCard {
  id: CardId;
  /** `null` pour un joker. */
  rank: RamiRank | null;
  /** `null` pour un joker. */
  suit: Suit | null;
  joker: boolean;
  /** Paquet d'origine : 0 ou 1. Les jokers portent 0 à 3. */
  deck: number;
}

/* ------------------------------------------------------------------ */
/* Combinaisons                                                        */
/* ------------------------------------------------------------------ */

/** `run` = tierce (suite de même enseigne) · `set` = brelan ou carré. */
export type MeldKind = 'run' | 'set';

/**
 * Ce qu'un joker représente sur la table.
 *
 * - Dans une tierce, il représente une carte **exacte** : valeur + enseigne
 *   (le ♥7 de `♥5 ♥6 JOKER ♥8`). Il faut ce ♥7 précis pour le récupérer.
 * - Dans un brelan, seule la valeur est déterminée : les enseignes manquantes
 *   restent ouvertes, et il faut **toutes** les apporter pour le récupérer.
 */
export interface JokerRole {
  rank: RamiRank;
  suit: Suit | null;
  /** Position dans la suite (1 à 14) : fixe la valeur en points de l'As. */
  runValue: RunValue | null;
}

export interface MeldSlot {
  /** La carte physiquement posée (peut être un joker). */
  card: RamiCard;
  /** Renseigné uniquement pour un joker. */
  jokerRole: JokerRole | null;
  /**
   * Position occupée dans la suite (1 à 14), `null` dans un brelan.
   * C'est elle qui fixe si un As vaut 1 (A-2-3) ou 11 (Q-K-A).
   */
  runValue: RunValue | null;
  /** Joueur qui a posé cette carte : sert au récit visuel, pas aux règles. */
  byId: string;
}

export interface Meld {
  id: string;
  kind: MeldKind;
  /** Équipe propriétaire. En 1 vs 1 et 1 vs 1 vs 1, chaque joueur est son équipe. */
  teamId: number;
  /** Joueur qui a ouvert la combinaison. */
  ownerId: string;
  /** Pour une tierce : l'enseigne commune. `null` pour un brelan. */
  suit: Suit | null;
  /** Pour un brelan : la valeur commune. `null` pour une tierce. */
  rank: RamiRank | null;
  /** Cartes dans l'ordre de la table. Une tierce est triée par position croissante. */
  slots: MeldSlot[];
  /** Manche de création : les combinaisons ne survivent pas à une manche. */
  roundNumber: number;
}

/* ------------------------------------------------------------------ */
/* Joueurs, équipes, modes                                             */
/* ------------------------------------------------------------------ */

export type GameMode = '1v1' | '1v1v1' | '2v2';

export interface RamiPlayer {
  id: string;
  name: string;
  avatar: string;
  seat: number;
  teamId: number;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  /** Main privée. Ne franchit jamais la frontière de `view.ts`. */
  hand: RamiCard[];
  /**
   * A posé au moins une combinaison pendant la manche.
   * Décide des 100 points forfaitaires et du droit de compléter.
   */
  hasEntered: boolean;
  /** Score cumulé personnel (informatif ; le score qui compte est celui de l'équipe). */
  score: number;
}

export interface TeamOpening {
  opened: boolean;
  /** Points de l'ouverture réellement réalisée : fixe le seuil de l'équipe suivante. */
  score: number;
  /** Joueur qui a ouvert pour l'équipe. */
  byId: string | null;
}

export interface Team {
  id: number;
  /** Score cumulé. Atteindre ou dépasser la cible fait **perdre**. */
  score: number;
  opening: TeamOpening;
}

/* ------------------------------------------------------------------ */
/* Tour de jeu                                                         */
/* ------------------------------------------------------------------ */

/**
 * Un tour se déroule toujours dans cet ordre :
 * `draw` (pioche ou reprise), puis `meld`.
 *
 * L'étape `meld` couvre les poses — facultatives — **et** la défausse, qui
 * clôt le tour et reste obligatoire (règle 11). Le donneur entame la manche
 * directement en `meld` : il a 15 cartes, ne pioche pas, et doit jeter sa
 * quinzième carte.
 */
export type TurnStage = 'draw' | 'meld';

export interface TurnState {
  stage: TurnStage;
  /** D'où vient la carte de ce tour. `null` pour le tour d'ouverture du donneur. */
  drawnFrom: 'stock' | 'discard' | null;
  /**
   * Carte reprise dans la défausse. Elle **doit** être utilisée dans une
   * combinaison avant la défausse : c'est la règle la plus contraignante du jeu.
   */
  takenCardId: CardId | null;
  /** La carte reprise a été intégrée à une combinaison. */
  takenCardUsed: boolean;
  /** Le joueur a posé ou complété au moins une combinaison pendant ce tour. */
  meldedThisTurn: boolean;
  /** Le donneur du premier tour ne pioche pas. */
  isDealerOpening: boolean;
}

export type Phase = 'lobby' | 'dealing' | 'playing' | 'round_end' | 'game_over';

export interface RamiSettings {
  mode: GameMode;
  /** Durée d'un tour, en secondes. */
  turnSeconds: number;
  /** Score à ne pas atteindre : 401 en 1 vs 1, 601 sinon. */
  targetScore: number;
  /** Points minimum de la première ouverture (71 dans la variante maison). */
  openingThreshold: number;
}

/* ------------------------------------------------------------------ */
/* Résultats                                                           */
/* ------------------------------------------------------------------ */

export interface PlayerScoreLine {
  playerId: string;
  teamId: number;
  /** Gagnant de la manche (ou partenaire du gagnant en 2 vs 2). */
  isWinner: boolean;
  /** N'a jamais posé : 100 points forfaitaires. */
  neverMelded: boolean;
  /** Cartes restantes en main, pour l'écran de détail. */
  remaining: RamiCard[];
  /** Détail carte par carte, dans l'ordre de `remaining`. */
  breakdown: number[];
  points: number;
}

export interface TeamScoreLine {
  teamId: number;
  points: number;
  /** Score cumulé **après** cette manche. */
  total: number;
  isWinner: boolean;
}

export interface RoundSummary {
  roundNumber: number;
  /** `null` si la manche s'est terminée sans gagnant (pioche épuisée, cas limite). */
  winnerId: string | null;
  winnerTeamId: number | null;
  players: PlayerScoreLine[];
  teams: TeamScoreLine[];
  /** Équipes ayant atteint ou dépassé la cible : elles perdent la partie. */
  bustedTeamIds: number[];
}

export interface GameOutcome {
  /** Équipe qui a atteint la cible : elle a **perdu**. */
  loserTeamIds: number[];
  /** Équipe au score le plus bas : elle a gagné. */
  winnerTeamId: number;
  rounds: number;
}

/* ------------------------------------------------------------------ */
/* État global                                                         */
/* ------------------------------------------------------------------ */

export interface RamiState {
  phase: Phase;
  settings: RamiSettings;
  roundNumber: number;
  players: RamiPlayer[];
  teams: Team[];
  /** Pioche. Secrète : seul son effectif traverse `view.ts`. */
  stock: RamiCard[];
  /**
   * Défausse, de la plus ancienne à la plus récente.
   * Seule la carte du dessus est publique — comme sur une vraie table.
   */
  discard: RamiCard[];
  melds: Meld[];
  /** Donneur de la manche : 15 cartes, entame, ne pioche pas. */
  dealerId: string | null;
  currentPlayerId: string | null;
  turn: TurnState | null;
  turnDeadline: number | null;
  turnTotalMs: number | null;
  phaseEndsAt: number | null;
  /** Compteur monotone incrémenté à chaque mutation : détection de désynchronisation. */
  version: number;
  /** État du générateur pseudo-aléatoire : parties reproductibles en test. */
  seed: number;
  /** Nombre de recyclages de la défausse dans la manche (affiché, et garde-fou). */
  recycles: number;
  lastSummary: RoundSummary | null;
  outcome: GameOutcome | null;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Description d'une combinaison proposée par un client. */
export interface MeldProposal {
  kind: MeldKind;
  /** Cartes de la main, dans l'ordre souhaité pour une tierce. */
  cardIds: CardId[];
  /**
   * Pour un joker dans une tierce, le client peut préciser la carte représentée.
   * Le serveur la déduit seul quand elle est sans ambiguïté.
   */
  jokerRank?: RamiRank;
  jokerSuit?: Suit;
}

export type RamiAction =
  | { type: 'start_game'; playerId: string }
  | { type: 'draw_stock'; playerId: string }
  | { type: 'take_discard'; playerId: string }
  /** Remet la carte reprise sur la défausse : le joueur repart de la pioche. */
  | { type: 'cancel_take'; playerId: string }
  | { type: 'lay_melds'; playerId: string; melds: MeldProposal[] }
  | { type: 'extend_meld'; playerId: string; meldId: string; cardIds: CardId[] }
  | { type: 'reclaim_joker'; playerId: string; meldId: string; cardIds: CardId[] }
  | { type: 'discard'; playerId: string; cardId: CardId }
  | { type: 'next_round'; playerId: string }
  | { type: 'restart'; playerId: string }
  | { type: 'tick' };

/* ------------------------------------------------------------------ */
/* Événements (pilotent le motion design côté client)                  */
/* ------------------------------------------------------------------ */

export type RamiEvent =
  | {
      type: 'round_start';
      roundNumber: number;
      dealerId: string;
      perPlayer: Record<string, number>;
    }
  | { type: 'turn'; playerId: string; deadline: number | null; stage: TurnStage }
  | {
      type: 'draw';
      playerId: string;
      from: 'stock' | 'discard';
      /** Renseigné pour le piocheur, et pour tous si la carte vient de la défausse. */
      card: RamiCard | null;
      stockLeft: number;
    }
  | { type: 'take_cancelled'; playerId: string; card: RamiCard }
  | {
      type: 'meld_laid';
      playerId: string;
      teamId: number;
      meldIds: string[];
      /** Points de la pose : sert à l'annonce d'ouverture. */
      points: number;
      isOpening: boolean;
    }
  | {
      type: 'meld_extended';
      playerId: string;
      meldId: string;
      cards: RamiCard[];
    }
  | {
      type: 'joker_reclaimed';
      playerId: string;
      meldId: string;
      joker: RamiCard;
      replacedBy: RamiCard[];
      /** La combinaison appartenait à une autre équipe. */
      fromOpponent: boolean;
    }
  | { type: 'discard'; playerId: string; card: RamiCard; handLeft: number }
  | { type: 'recycle'; count: number }
  | { type: 'round_end'; summary: RoundSummary }
  | { type: 'game_over'; outcome: GameOutcome }
  | { type: 'timeout'; playerId: string };

/** Événement horodaté tel qu'il transite sur le fil temps réel. */
export interface StampedRamiEvent {
  seq: number;
  at: number;
  event: RamiEvent;
}
