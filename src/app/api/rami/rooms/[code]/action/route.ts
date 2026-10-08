import {
  validateCancelTake,
  validateDiscard,
  validateDrawStock,
  validateExtend,
  validateLayMelds,
  validateReclaim,
  validateTakeDiscard,
} from '@/rami/moves';
import { normalizeRoomCode } from '@/server/codes';
import {
  jsonError,
  readJson,
  sanitizeMeldId,
  sanitizeMeldProposals,
  sanitizeRamiCardIds,
  sanitizeRamiSettings,
} from '@/server/input';
import { ramiStore, type RamiRoom } from '@/server/ramiStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Point d'entrée unique des actions joueur.
 *
 * Le jeton ne sert qu'à **identifier** : aucun droit n'en découle. Chaque coup
 * est revalidé par le moteur contre l'état serveur, et le message renvoyé au
 * joueur est celui du moteur — une phrase en français, jamais un code.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = await ramiStore.findRoom(normalizeRoomCode(code));
  if (!room) return jsonError("Cette salle n'existe pas ou a expiré.", 404);

  const body = await readJson(request);
  const token = typeof body.token === 'string' ? body.token : null;
  const playerId = ramiStore.playerIdForToken(room, token);
  if (!playerId) return jsonError('Session invalide. Rejoignez la salle à nouveau.', 401);
  if (!room.state.players.some((player) => player.id === playerId)) {
    return jsonError('Vous ne faites plus partie de cette table.', 401);
  }

  // Il joue : il est là, quel que soit l'état de son flux temps réel.
  ramiStore.touchPlayer(room, playerId);

  const action = typeof body.action === 'string' ? body.action : '';
  const error = handle(room, playerId, action, body);
  if (error) return jsonError(error, 400);

  // La salle doit être persistée avant la réponse : sinon, sur un hébergeur
  // sans serveur, la requête suivante ne la retrouverait pas.
  await ramiStore.flush(room);

  return Response.json({ ok: true, view: ramiStore.buildView(room, playerId) });
}

function handle(
  room: RamiRoom,
  playerId: string,
  action: string,
  body: Record<string, unknown>,
): string | null {
  switch (action) {
    case 'start_game': {
      if (!ramiStore.canStart(room)) {
        return 'La table doit être complète pour lancer la partie.';
      }
      const before = room.state.version;
      ramiStore.dispatch(room, { type: 'start_game', playerId });
      return room.state.version === before ? 'Seul l’hôte peut lancer la partie.' : null;
    }

    case 'draw_stock': {
      const check = validateDrawStock(room.state, playerId);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'draw_stock', playerId });
      return null;
    }

    case 'take_discard': {
      const check = validateTakeDiscard(room.state, playerId);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'take_discard', playerId });
      return null;
    }

    case 'cancel_take': {
      const check = validateCancelTake(room.state, playerId);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'cancel_take', playerId });
      return null;
    }

    case 'lay_melds': {
      const melds = sanitizeMeldProposals(body.melds);
      if (!melds) return 'Combinaisons invalides.';
      const check = validateLayMelds(room.state, playerId, melds);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'lay_melds', playerId, melds });
      return null;
    }

    case 'extend_meld': {
      const meldId = sanitizeMeldId(body.meldId);
      const cardIds = sanitizeRamiCardIds(body.cardIds);
      if (!meldId || !cardIds) return 'Sélection invalide.';
      const check = validateExtend(room.state, playerId, meldId, cardIds);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'extend_meld', playerId, meldId, cardIds });
      return null;
    }

    case 'reclaim_joker': {
      const meldId = sanitizeMeldId(body.meldId);
      const cardIds = sanitizeRamiCardIds(body.cardIds, 3);
      if (!meldId || !cardIds) return 'Sélection invalide.';
      const check = validateReclaim(room.state, playerId, meldId, cardIds);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'reclaim_joker', playerId, meldId, cardIds });
      return null;
    }

    case 'discard': {
      const cardId = typeof body.cardId === 'string' ? body.cardId : '';
      const ids = sanitizeRamiCardIds([cardId], 1);
      if (!ids) return 'Carte invalide.';
      const check = validateDiscard(room.state, playerId, ids[0]);
      if (!check.ok) return check.message;
      ramiStore.dispatch(room, { type: 'discard', playerId, cardId: ids[0] });
      return null;
    }

    case 'next_round': {
      const before = room.state.version;
      ramiStore.dispatch(room, { type: 'next_round', playerId });
      return room.state.version === before ? 'Manche suivante indisponible.' : null;
    }

    case 'restart': {
      const before = room.state.version;
      ramiStore.dispatch(room, { type: 'restart', playerId });
      return room.state.version === before ? 'Relance indisponible.' : null;
    }

    case 'leave':
      return ramiStore.leaveRoom(room, playerId);

    case 'add_bot':
      return ramiStore.addBot(room, playerId);

    case 'kick': {
      const targetId = typeof body.targetId === 'string' ? body.targetId : '';
      if (!targetId) return 'Joueur introuvable.';
      return ramiStore.kickPlayer(room, playerId, targetId);
    }

    case 'settings':
      return ramiStore.updateSettings(room, playerId, sanitizeRamiSettings(body.settings));

    default:
      return 'Action inconnue.';
  }
}
