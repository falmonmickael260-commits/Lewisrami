import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoomStore, type GameAdapter, type Subscriber } from './roomStore';

/**
 * Tests de la plomberie des salles, là où se jouent les pertes de connexion.
 *
 * Le jeu est remplacé par un adaptateur minuscule : ce qui est vérifié ici
 * n'est pas une règle de Rami, c'est le comportement du serveur quand un flux
 * se coupe, quand une minuterie n'a pas tourné, ou quand deux instances
 * tiennent la même salle.
 */

interface FakeState {
  version: number;
  phase: string;
  players: { id: string; isBot: boolean; isHost: boolean; connected: boolean }[];
  /** Échéance du tour : sert à vérifier le rattrapage du chrono. */
  deadline: number | null;
  ticks: number;
}

type FakeAction = { type: 'tick' } | { type: 'bot' };

function makeAdapter(): GameAdapter<FakeState, FakeAction, string, FakeState> {
  return {
    key: `test${Math.random().toString(36).slice(2)}`,
    label: 'Test',
    createGame: () => ({ version: 1, phase: 'lobby', players: [], deadline: null, ticks: 0 }),
    addPlayer: (state, player) => ({
      ...state,
      version: state.version + 1,
      players: [
        ...state.players,
        {
          id: player.id,
          isBot: player.isBot ?? false,
          isHost: state.players.length === 0,
          connected: true,
        },
      ],
    }),
    removePlayer: (state, playerId) => ({
      ...state,
      version: state.version + 1,
      players: state.players.filter((player) => player.id !== playerId),
    }),
    setConnected: (state, playerId, connected) => {
      if (!state.players.some((p) => p.id === playerId && p.connected !== connected)) return state;
      return {
        ...state,
        version: state.version + 1,
        players: state.players.map((player) =>
          player.id === playerId ? { ...player, connected } : player,
        ),
      };
    },
    reduce: (state, action) => {
      if (action.type === 'tick') {
        return {
          state: { ...state, version: state.version + 1, ticks: state.ticks + 1, deadline: null },
          events: ['tick'],
        };
      }
      return { state: { ...state, version: state.version + 1 }, events: ['bot'] };
    },
    tickAction: { type: 'tick' },
    nextDeadline: (state) => state.deadline,
    buildView: (state) => state,
    redactEvent: (event) => event,
    players: (state) => state.players,
    version: (state) => state.version,
    phase: (state) => state.phase,
    isLobby: (state) => state.phase === 'lobby',
    capacity: () => 4,
    joinability: () => ({ ok: true }),
    canStart: () => true,
    applySettings: (state) => ({ state, error: null }),
    decideBot: () => ({ type: 'bot' }),
    botPendingPlayerId: () => null,
    botNames: ['Ada'],
    botAvatars: ['🤖'],
  };
}

function fakeSubscriber(playerId: string | null): Subscriber<FakeState, string> {
  return { id: `s${Math.random()}`, playerId, send: () => {} };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('présence : une coupure de flux n’est pas une absence', () => {
  it('garde le joueur en ligne pendant la reconnexion', async () => {
    const store = createRoomStore(makeAdapter());
    const room = store.createRoom();
    const join = store.joinRoom(room, 'Camille', '🦊');
    expect(join.ok).toBe(true);
    if (!join.ok) return;

    const first = fakeSubscriber(join.playerId);
    store.attach(room, first);
    store.detach(room, first);

    // Le navigateur se reconnecte en une fraction de seconde : entre-temps,
    // le joueur doit rester annoncé présent.
    await vi.advanceTimersByTimeAsync(1500);
    expect(room.state.players[0].connected).toBe(true);

    store.attach(room, fakeSubscriber(join.playerId));
    await vi.advanceTimersByTimeAsync(30000);
    expect(room.state.players[0].connected).toBe(true);
  });

  it('finit par déclarer absent celui qui ne revient pas', async () => {
    const store = createRoomStore(makeAdapter());
    const room = store.createRoom();
    const join = store.joinRoom(room, 'Camille', '🦊');
    if (!join.ok) return;
    room.state = { ...room.state, phase: 'playing' };

    const subscriber = fakeSubscriber(join.playerId);
    store.attach(room, subscriber);
    store.detach(room, subscriber);

    await vi.advanceTimersByTimeAsync(30000);
    expect(room.state.players[0].connected).toBe(false);
  });

  it('un coup joué vaut signe de vie, même sans flux', async () => {
    const store = createRoomStore(makeAdapter());
    const room = store.createRoom();
    const join = store.joinRoom(room, 'Camille', '🦊');
    if (!join.ok) return;
    room.state = { ...room.state, phase: 'playing' };

    const subscriber = fakeSubscriber(join.playerId);
    store.attach(room, subscriber);
    store.detach(room, subscriber);
    await vi.advanceTimersByTimeAsync(30000);
    expect(room.state.players[0].connected).toBe(false);

    store.touchPlayer(room, join.playerId);
    expect(room.state.players[0].connected).toBe(true);

    // Et le compte à rebours de l'absence ne doit pas se rallumer tout seul.
    await vi.advanceTimersByTimeAsync(30000);
    expect(room.state.players[0].connected).toBe(true);
  });
});

describe('rattrapage : une partie ne gèle pas faute de minuterie', () => {
  it('rejoue le chrono échu à la requête suivante', async () => {
    const adapter = makeAdapter();
    const store = createRoomStore(adapter);
    const room = store.createRoom();
    room.state = { ...room.state, phase: 'playing', deadline: Date.now() - 5000 };

    // Aucune minuterie n'a tourné : c'est la lecture de la salle qui rattrape.
    const found = await store.findRoom(room.code);
    expect(found).toBe(room);
    expect(room.state.ticks).toBe(1);
  });

  it('ne rejoue rien quand l’échéance n’est pas atteinte', async () => {
    const store = createRoomStore(makeAdapter());
    const room = store.createRoom();
    room.state = { ...room.state, phase: 'playing', deadline: Date.now() + 60000 };

    await store.findRoom(room.code);
    expect(room.state.ticks).toBe(0);
  });
});
