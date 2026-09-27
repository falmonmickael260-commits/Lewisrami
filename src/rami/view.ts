/**
 * Projection de l'état pour un joueur donné.
 *
 * C'est la **frontière de confidentialité** du jeu : aucune main adverse, aucune
 * carte de la pioche ne traverse cette fonction. Un joueur ne reçoit que sa
 * propre main, plus ce qui est public sur une vraie table — la carte du dessus
 * de la défausse, les combinaisons posées, et le nombre de cartes des autres.
 */

import { sortHand } from './cards';
import { openingRequirementFor } from './scoring';
import type {
  GameOutcome,
  Meld,
  Phase,
  RamiCard,
  RamiSettings,
  RamiState,
  RoundSummary,
  Team,
  TurnStage,
} from './types';

/** Projection publique d'un joueur : un compteur, jamais de cartes. */
export interface PublicRamiPlayer {
  id: string;
  name: string;
  avatar: string;
  seat: number;
  teamId: number;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  /** A posé au moins une combinaison : sans cela, 100 points en fin de manche. */
  hasEntered: boolean;
  score: number;
}

/**
 * Ce que tout le monde peut savoir du tour en cours.
 *
 * `takenCardId` est public : reprendre la carte du dessus de la défausse est un
 * geste visible de tous, et savoir qu'un adversaire doit l'utiliser fait partie
 * du jeu.
 */
export interface PublicTurn {
  stage: TurnStage;
  drawnFrom: 'stock' | 'discard' | null;
  takenCardId: string | null;
  takenCardUsed: boolean;
  meldedThisTurn: boolean;
  isDealerOpening: boolean;
}

/** Aides destinées à l'interface. Elles ne créent aucun droit : le serveur revalide tout. */
export interface RamiHints {
  /** Points minimum de votre prochaine pose, `null` si vous êtes déjà entré. */
  openingPoints: number | null;
  /** Explication en clair du seuil à atteindre. */
  openingLabel: string | null;
  /** Une tierce de trois vraies cartes est-elle exigée dans votre prochaine pose ? */
  requiresOpeningRun: boolean;
  /** La carte reprise dans la défausse attend d'être utilisée. */
  mustUseTakenCard: boolean;
  /** Vous pouvez compléter les combinaisons de votre équipe. */
  canExtend: boolean;
  /** Toutes les équipes ont ouvert : les combinaisons adverses sont accessibles. */
  canTouchOpponents: boolean;
  /** Meilleure ouverture déjà réalisée sur la table. */
  bestOpening: number | null;
}

export interface RamiPlayerView {
  phase: Phase;
  settings: RamiSettings;
  roundNumber: number;
  players: PublicRamiPlayer[];
  teams: Team[];
  /** Main privée du destinataire de cette vue. */
  hand: RamiCard[];
  youId: string | null;
  dealerId: string | null;
  currentPlayerId: string | null;
  turn: PublicTurn | null;
  /** Effectif de la pioche. Son contenu reste secret. */
  stockCount: number;
  /** Carte du dessus de la défausse : la seule visible, comme sur une vraie table. */
  discardTop: RamiCard | null;
  discardCount: number;
  melds: Meld[];
  turnDeadline: number | null;
  turnTotalMs: number | null;
  phaseEndsAt: number | null;
  recycles: number;
  lastSummary: RoundSummary | null;
  outcome: GameOutcome | null;
  hints: RamiHints;
  version: number;
  /** Horloge serveur : le client corrige sa dérive pour afficher un chrono juste. */
  serverNow: number;
}

function toPublic(state: RamiState): PublicRamiPlayer[] {
  return state.players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      seat: player.seat,
      teamId: player.teamId,
      isHost: player.isHost,
      isBot: player.isBot,
      connected: player.connected,
      cardCount: player.hand.length,
      hasEntered: player.hasEntered,
      score: player.score,
    }));
}

function buildHints(state: RamiState, viewerId: string | null): RamiHints {
  const me = viewerId ? state.players.find((player) => player.id === viewerId) : undefined;
  const bestOpening = state.teams
    .filter((team) => team.opening.opened)
    .reduce<number | null>(
      (best, team) => (best === null ? team.opening.score : Math.max(best, team.opening.score)),
      null,
    );

  if (!me || state.phase !== 'playing') {
    return {
      openingPoints: null,
      openingLabel: null,
      requiresOpeningRun: false,
      mustUseTakenCard: false,
      canExtend: false,
      canTouchOpponents: false,
      bestOpening,
    };
  }

  const requirement = openingRequirementFor(state, me);
  const team = state.teams.find((entry) => entry.id === me.teamId);
  const isMyTurn = state.currentPlayerId === me.id;
  const turn = state.turn;

  return {
    openingPoints: requirement ? requirement.points : null,
    openingLabel: requirement ? requirement.label : null,
    requiresOpeningRun: requirement ? requirement.requiresRun : false,
    mustUseTakenCard: Boolean(
      isMyTurn && turn && turn.takenCardId !== null && !turn.takenCardUsed,
    ),
    canExtend: Boolean(me.hasEntered && team?.opening.opened),
    canTouchOpponents: Boolean(
      me.hasEntered && state.teams.every((entry) => entry.opening.opened),
    ),
    bestOpening,
  };
}

/**
 * Construit la vue destinée à un joueur.
 * Aucune main adverse et aucune carte de la pioche ne franchit cette frontière.
 */
export function buildRamiView(
  state: RamiState,
  viewerId: string | null,
  now: number = Date.now(),
): RamiPlayerView {
  const me = viewerId ? state.players.find((player) => player.id === viewerId) : undefined;

  return {
    phase: state.phase,
    settings: state.settings,
    roundNumber: state.roundNumber,
    players: toPublic(state),
    teams: state.teams.map((team) => ({ ...team, opening: { ...team.opening } })),
    hand: me ? sortHand(me.hand) : [],
    youId: me?.id ?? null,
    dealerId: state.dealerId,
    currentPlayerId: state.currentPlayerId,
    turn: state.turn ? { ...state.turn } : null,
    stockCount: state.stock.length,
    discardTop: state.discard[state.discard.length - 1] ?? null,
    discardCount: state.discard.length,
    melds: state.melds.map((meld) => ({
      ...meld,
      slots: meld.slots.map((slot) => ({
        ...slot,
        jokerRole: slot.jokerRole ? { ...slot.jokerRole } : null,
      })),
    })),
    turnDeadline: state.turnDeadline,
    turnTotalMs: state.turnTotalMs,
    phaseEndsAt: state.phaseEndsAt,
    recycles: state.recycles,
    lastSummary: state.lastSummary,
    outcome: state.outcome,
    hints: buildHints(state, viewerId ?? null),
    version: state.version,
    serverNow: now,
  };
}

/**
 * Retire d'un événement ce que le destinataire n'a pas le droit de voir.
 *
 * Seule la pioche est concernée : la carte tirée du talon n'appartient qu'à
 * celui qui l'a tirée. Une carte reprise dans la défausse était déjà publique.
 */
export function redactRamiEvent<E extends { type: string }>(event: E, viewerId: string | null): E {
  if (event.type !== 'draw') return event;
  const draw = event as unknown as {
    type: 'draw';
    playerId: string;
    from: 'stock' | 'discard';
    card: RamiCard | null;
  };
  if (draw.from === 'discard' || draw.playerId === viewerId) return event;
  return { ...event, card: null } as E;
}
