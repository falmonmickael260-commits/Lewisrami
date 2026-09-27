/**
 * Score du Rami : seuils d'ouverture, points de fin de manche, fin de partie.
 *
 * Trois règles structurent tout le reste :
 * - le gagnant de la manche marque **0** (et son partenaire aussi, en 2 vs 2) ;
 * - un perdant qui n'a **jamais posé** marque **100 points forfaitaires** ;
 * - un perdant qui a posé compte uniquement les cartes restées dans sa main.
 *
 * Atteindre ou dépasser la cible (401 en 1 vs 1, 601 sinon) fait **perdre**.
 */

import { NEVER_MELDED_POINTS, handPoints } from './cards';
import type {
  GameMode,
  PlayerScoreLine,
  RamiPlayer,
  RamiState,
  RoundSummary,
  Team,
  TeamScoreLine,
} from './types';

/** Nombre de joueurs de chaque mode. */
export const PLAYERS_BY_MODE: Record<GameMode, number> = {
  '1v1': 2,
  '1v1v1': 3,
  '2v2': 4,
};

/** Score à ne pas atteindre, par mode. */
export const TARGET_BY_MODE: Record<GameMode, number> = {
  '1v1': 401,
  '1v1v1': 601,
  '2v2': 601,
};

/** Points minimum de la première ouverture. */
export const OPENING_THRESHOLD = 71;

export const MODE_LABELS: Record<GameMode, string> = {
  '1v1': '1 vs 1',
  '1v1v1': '1 vs 1 vs 1',
  '2v2': '2 vs 2',
};

/** Seul le mode 2 vs 2 a des partenaires. */
export function hasTeams(mode: GameMode): boolean {
  return mode === '2v2';
}

/**
 * Équipe d'un siège.
 *
 * En 2 vs 2, les partenaires sont **face à face** : sièges 0 et 2 contre 1 et 3,
 * comme sur une vraie table. Dans les autres modes, chaque joueur est sa propre
 * équipe, ce qui permet au reste du moteur d'ignorer complètement la distinction.
 */
export function teamOfSeat(seat: number, mode: GameMode): number {
  return mode === '2v2' ? seat % 2 : seat;
}

export function teamCount(mode: GameMode): number {
  return mode === '2v2' ? 2 : PLAYERS_BY_MODE[mode];
}

/* ------------------------------------------------------------------ */
/* Seuil d'ouverture                                                   */
/* ------------------------------------------------------------------ */

export interface OpeningRequirement {
  /** Points minimum à poser. */
  points: number;
  /** Une tierce de trois vraies cartes est-elle exigée ? */
  requiresRun: boolean;
  /** L'équipe a déjà ouvert : il ne reste qu'à respecter la tierce du partenaire. */
  teamAlreadyOpened: boolean;
  /** Explication affichable. */
  label: string;
}

/**
 * Ce que doit réaliser un joueur pour poser sa première combinaison.
 *
 * - Première équipe à ouvrir : 71 points minimum, dont une tierce de trois
 *   vraies cartes. Le joker compte pour la carte qu'il représente, et peut donc
 *   servir à atteindre les 71 — dans une **autre** combinaison que la tierce.
 * - Équipe suivante : elle doit **dépasser** la meilleure ouverture déjà
 *   réalisée (71 → 72, 119 → 120, 150 → 151).
 * - Partenaire d'un joueur qui a déjà ouvert pour l'équipe : plus de seuil de
 *   points, mais une tierce au minimum.
 */
export function openingRequirementFor(
  state: Pick<RamiState, 'teams' | 'settings'>,
  player: Pick<RamiPlayer, 'teamId' | 'hasEntered'>,
): OpeningRequirement | null {
  const team = state.teams.find((entry) => entry.id === player.teamId);
  if (!team) return null;

  if (team.opening.opened) {
    if (player.hasEntered) return null;
    return {
      points: 0,
      requiresRun: true,
      teamAlreadyOpened: true,
      label:
        'Votre équipe a déjà ouvert : posez au minimum une tierce de trois vraies cartes.',
    };
  }

  const best = highestOpeningScore(state.teams);
  const points = best === null ? state.settings.openingThreshold : best + 1;
  return {
    points,
    requiresRun: true,
    teamAlreadyOpened: false,
    label:
      best === null
        ? `Il faut au minimum ${points} points pour ouvrir, dont une tierce de trois vraies cartes.`
        : `L’équipe adverse a ouvert à ${best} points : il vous faut au minimum ${points} points.`,
  };
}

/** Meilleure ouverture déjà réalisée, ou `null` si personne n'a ouvert. */
export function highestOpeningScore(teams: readonly Team[]): number | null {
  const scores = teams
    .filter((team) => team.opening.opened)
    .map((team) => team.opening.score);
  return scores.length === 0 ? null : Math.max(...scores);
}

/* ------------------------------------------------------------------ */
/* Fin de manche                                                       */
/* ------------------------------------------------------------------ */

/**
 * Points d'un joueur en fin de manche.
 * `null` en gagnant : le gagnant et son partenaire marquent zéro.
 */
export function playerRoundLine(
  player: RamiPlayer,
  winnerTeamId: number | null,
): PlayerScoreLine {
  const isWinner = winnerTeamId !== null && player.teamId === winnerTeamId;
  const remaining = player.hand.slice();

  if (isWinner) {
    return {
      playerId: player.id,
      teamId: player.teamId,
      isWinner: true,
      neverMelded: !player.hasEntered,
      remaining,
      breakdown: remaining.map(() => 0),
      points: 0,
    };
  }

  if (!player.hasEntered) {
    return {
      playerId: player.id,
      teamId: player.teamId,
      isWinner: false,
      neverMelded: true,
      remaining,
      breakdown: remaining.map(() => 0),
      points: NEVER_MELDED_POINTS,
    };
  }

  const breakdown = remaining.map((card) => handPoints(card));
  return {
    playerId: player.id,
    teamId: player.teamId,
    isWinner: false,
    neverMelded: false,
    remaining,
    breakdown,
    points: breakdown.reduce((sum, value) => sum + value, 0),
  };
}

/**
 * Feuille de score complète d'une manche.
 * Les scores d'équipe cumulés sont calculés ici, mais appliqués par le moteur.
 */
export function buildRoundSummary(
  state: Pick<RamiState, 'players' | 'teams' | 'roundNumber' | 'settings'>,
  winnerId: string | null,
): RoundSummary {
  const winner = winnerId
    ? state.players.find((player) => player.id === winnerId)
    : undefined;
  const winnerTeamId = winner ? winner.teamId : null;

  const players = state.players.map((player) => playerRoundLine(player, winnerTeamId));

  const teams: TeamScoreLine[] = state.teams.map((team) => {
    const points = players
      .filter((line) => line.teamId === team.id)
      .reduce((sum, line) => sum + line.points, 0);
    return {
      teamId: team.id,
      points,
      total: team.score + points,
      isWinner: winnerTeamId === team.id,
    };
  });

  const bustedTeamIds = teams
    .filter((team) => team.total >= state.settings.targetScore)
    .map((team) => team.teamId);

  return {
    roundNumber: state.roundNumber,
    winnerId: winnerId ?? null,
    winnerTeamId,
    players,
    teams,
    bustedTeamIds,
  };
}

/**
 * Équipe gagnante de la partie : celle qui a le score le **plus bas**.
 * En cas d'égalité, la première par identifiant — cas que le jeu évite
 * en pratique, puisqu'une manche ne finit jamais sur deux scores identiques
 * quand une seule équipe franchit la cible.
 */
export function winnerTeamOf(teams: readonly TeamScoreLine[]): number {
  return teams.reduce(
    (best, team) => (team.total < best.total ? team : best),
    teams[0],
  ).teamId;
}
