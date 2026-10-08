/**
 * Plomberie des salles, commune à tous les jeux de la maison.
 *
 * Tout ce qui n'est pas une règle de jeu vit ici : cycle de vie d'une salle,
 * jetons d'identité, abonnés au flux temps réel, chrono serveur, bots,
 * présence et persistance. Le jeu lui-même est fourni par un **adaptateur**
 * (`GameAdapter`), ce qui permet au Président et au Rami de partager cette
 * couche sans rien dupliquer — et sans se mélanger : chacun a son registre.
 *
 * Deux principes ne bougent jamais :
 * - le serveur fait autorité : toute action est revalidée par le moteur ;
 * - chaque abonné reçoit une vue **personnalisée**, sa main et rien d'autre.
 */

import { generatePlayerId, generateRoomCode, generateToken } from './codes';
import { createPersistence, type Persistence } from './persistence';

export interface PublicPlayerShape {
  id: string;
  isBot: boolean;
  isHost: boolean;
  connected: boolean;
}

/**
 * Contrat qu'un jeu doit remplir pour être hébergé par ce store.
 * `S` = état, `A` = action, `E` = événement, `V` = vue joueur.
 */
export interface GameAdapter<S, A, E, V> {
  /** Identifiant du jeu : sert de clé de registre et de table de persistance. */
  key: string;
  /** Nom lisible, utilisé dans les messages d'erreur. */
  label: string;

  createGame(settings?: unknown): S;
  addPlayer(state: S, player: { id: string; name: string; avatar: string; isBot?: boolean }): S;
  removePlayer(state: S, playerId: string): S;
  setConnected(state: S, playerId: string, connected: boolean): S;

  reduce(state: S, action: A, now: number): { state: S; events: E[] };
  /** Action d'horloge, déclenchée par le planificateur. */
  tickAction: A;
  nextDeadline(state: S): number | null;

  buildView(state: S, viewerId: string | null, now: number): V;
  redactEvent(event: E, viewerId: string | null): E;

  players(state: S): PublicPlayerShape[];
  version(state: S): number;
  phase(state: S): string;
  isLobby(state: S): boolean;
  /** Nombre de places, pour la sonde publique d'une salle. */
  capacity(state: S): number;
  /** La salle accepte-t-elle un joueur de plus ? */
  joinability(state: S): { ok: true } | { ok: false; error: string };
  canStart(state: S): boolean;

  /** Réglages modifiables depuis le salon. Renvoie un message d'erreur, ou `null`. */
  applySettings(state: S, raw: unknown): { state: S; error: string | null };

  decideBot(state: S, playerId: string): A | null;
  /** Joueur dont le bot doit agir maintenant, ou `null`. */
  botPendingPlayerId(state: S): string | null;
  botNames: readonly string[];
  botAvatars: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Messages du flux temps réel                                         */
/* ------------------------------------------------------------------ */

export interface StampedEnvelope<E> {
  seq: number;
  at: number;
  event: E;
}

export type ServerMessage<V, E> =
  | { type: 'sync'; view: V; events: StampedEnvelope<E>[]; seq: number }
  | { type: 'error'; message: string }
  | { type: 'ping'; at: number }
  | { type: 'closed'; reason: string };

export interface Subscriber<V, E> {
  id: string;
  playerId: string | null;
  send: (message: ServerMessage<V, E>) => void;
}

export interface Room<S, V, E> {
  code: string;
  state: S;
  /** jeton secret → identifiant de joueur. Jamais transmis à un autre joueur. */
  tokens: Map<string, string>;
  subscribers: Set<Subscriber<V, E>>;
  history: StampedEnvelope<E>[];
  seq: number;
  updatedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  botTimer: ReturnType<typeof setTimeout> | null;
  dropTimers: Map<string, ReturnType<typeof setTimeout>>;
  /**
   * Instant où le bot doit jouer, et version de l'état à ce moment-là.
   *
   * Sur un hébergeur sans serveur, aucune minuterie ne survit à la réponse :
   * le bot ne jouerait jamais et la partie semblerait gelée. L'échéance est
   * donc notée pour être rattrapée à la requête suivante.
   */
  botDueAt: number | null;
  botVersion: number | null;
  /**
   * Dernière écriture de persistance en cours.
   *
   * Sur un hébergeur sans serveur, la fonction peut se figer dès la réponse
   * envoyée : une écriture lancée sans être attendue n'arrive jamais, et la
   * salle est introuvable à la requête suivante. Les routes attendent donc
   * cette promesse avant de répondre.
   */
  pendingSave: Promise<void> | null;
}

/* ------------------------------------------------------------------ */
/* Réglages du store                                                   */
/* ------------------------------------------------------------------ */

const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const EVENT_HISTORY = 80;
const BOT_MIN_DELAY = 850;
const BOT_MAX_DELAY = 1800;
/**
 * Délai avant de déclarer un joueur hors ligne.
 *
 * Un flux SSE ne tient pas indéfiniment : la plateforme le coupe, un proxy
 * s'en mêle, le téléphone passe du wifi à la 4G. Le navigateur se reconnecte
 * en moins d'une seconde, mais déclarer le joueur absent dans l'intervalle
 * avait deux effets très visibles : la pastille « déconnecté » clignotait chez
 * les autres, et surtout son tour passait de soixante à huit secondes — il
 * était joué automatiquement à sa place. On attend donc de vraies secondes
 * avant de conclure à une absence.
 */
const PRESENCE_GRACE_MS = 10000;

interface Registry<S, V, E> {
  rooms: Map<string, Room<S, V, E>>;
  sweeper: ReturnType<typeof setInterval> | null;
}

export interface JoinOutcome {
  ok: true;
  token: string;
  playerId: string;
}
export interface JoinFailure {
  ok: false;
  error: string;
}

/**
 * Crée un store de salles pour un jeu donné.
 *
 * Le registre vit sur `globalThis` : sans cela, chaque rechargement à chaud de
 * Next.js en développement viderait toutes les salles en cours.
 */
export function createRoomStore<S, A, E, V>(adapter: GameAdapter<S, A, E, V>) {
  const globalKey = `__roomRegistry_${adapter.key}`;
  const globalRef = globalThis as unknown as Record<string, Registry<S, V, E> | undefined>;

  const registry: Registry<S, V, E> =
    globalRef[globalKey] ??
    (globalRef[globalKey] = { rooms: new Map(), sweeper: null });

  const persistence: Persistence<S> = createPersistence<S>(`${adapter.key}_rooms`);

  if (!registry.sweeper) {
    registry.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [code, room] of registry.rooms) {
        if (room.subscribers.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
          clearRoomTimers(room);
          registry.rooms.delete(code);
        }
      }
    }, 5 * 60 * 1000);
    registry.sweeper.unref?.();
  }

  function clearRoomTimers(room: Room<S, V, E>) {
    if (room.timer) clearTimeout(room.timer);
    if (room.botTimer) clearTimeout(room.botTimer);
    for (const timer of room.dropTimers.values()) clearTimeout(timer);
    room.dropTimers.clear();
    room.timer = null;
    room.botTimer = null;
  }

  /* ---------------------------------------------------------------- */
  /* Cycle de vie                                                     */
  /* ---------------------------------------------------------------- */

  function createRoom(settings?: unknown): Room<S, V, E> {
    let code = generateRoomCode();
    let guard = 0;
    while (registry.rooms.has(code) && guard++ < 50) code = generateRoomCode();

    const room: Room<S, V, E> = {
      code,
      state: adapter.createGame(settings),
      tokens: new Map(),
      subscribers: new Set(),
      history: [],
      seq: 0,
      updatedAt: Date.now(),
      timer: null,
      botTimer: null,
      dropTimers: new Map(),
      botDueAt: null,
      botVersion: null,
      pendingSave: null,
    };
    registry.rooms.set(code, room);
    return room;
  }

  /**
   * Récupère une salle : en mémoire, ou restaurée depuis la persistance.
   *
   * Quand la persistance est active, l'exemplaire en mémoire n'est pas
   * forcément le bon. Plusieurs instances servent le même site, et celle qui
   * reçoit l'action n'est pas toujours celle qui tient le flux temps réel :
   * sa copie peut avoir plusieurs coups de retard. Elle écraserait alors le
   * travail de l'autre, et les joueurs verraient des cartes revenir en
   * arrière. On compare donc les versions et on adopte la plus avancée.
   */
  async function findRoom(code: string): Promise<Room<S, V, E> | undefined> {
    const existing = registry.rooms.get(code);

    if (existing && !persistence.enabled) {
      catchUp(existing);
      return existing;
    }

    const restored = await persistence.load(code);

    if (existing) {
      if (restored && adapter.version(restored.state) > adapter.version(existing.state)) {
        existing.state = restored.state;
        existing.tokens = new Map(Object.entries(restored.tokens));
        existing.botDueAt = null;
        existing.botVersion = null;
        schedule(existing);
      }
      catchUp(existing);
      return existing;
    }

    if (!restored) return undefined;

    const room: Room<S, V, E> = {
      code,
      state: restored.state,
      tokens: new Map(Object.entries(restored.tokens)),
      subscribers: new Set(),
      history: [],
      seq: 0,
      updatedAt: Date.now(),
      timer: null,
      botTimer: null,
      dropTimers: new Map(),
      botDueAt: null,
      botVersion: null,
      pendingSave: null,
    };
    // Après une restauration, tout le monde est réputé déconnecté sauf les bots.
    for (const player of adapter.players(room.state)) {
      if (!player.isBot && player.connected) {
        room.state = adapter.setConnected(room.state, player.id, false);
      }
    }
    registry.rooms.set(code, room);
    schedule(room);
    catchUp(room);
    return room;
  }

  function playerIdForToken(room: Room<S, V, E>, token: string | null): string | null {
    if (!token) return null;
    return room.tokens.get(token) ?? null;
  }

  /* ---------------------------------------------------------------- */
  /* Mutations et diffusion                                           */
  /* ---------------------------------------------------------------- */

  function stamp(room: Room<S, V, E>, events: E[]): StampedEnvelope<E>[] {
    const at = Date.now();
    return events.map((event) => ({ seq: ++room.seq, at, event }));
  }

  function broadcast(room: Room<S, V, E>, events: StampedEnvelope<E>[]) {
    const now = Date.now();
    for (const subscriber of room.subscribers) {
      const view = adapter.buildView(room.state, subscriber.playerId, now);
      const redacted = events.map((entry) => ({
        ...entry,
        event: adapter.redactEvent(entry.event, subscriber.playerId),
      }));
      subscriber.send({ type: 'sync', view, events: redacted, seq: room.seq });
    }
  }

  /** Applique une mutation, journalise ses événements, diffuse et replanifie. */
  function commit(room: Room<S, V, E>, events: E[]) {
    const stamped = stamp(room, events);
    room.history.push(...stamped);
    if (room.history.length > EVENT_HISTORY) {
      room.history.splice(0, room.history.length - EVENT_HISTORY);
    }
    room.updatedAt = Date.now();
    broadcast(room, stamped);
    schedule(room);
    room.pendingSave = persistence.save(
      room.code,
      room.state,
      Object.fromEntries(room.tokens),
    );
  }

  /** Attend que la salle soit bien écrite avant de répondre au client. */
  async function flush(room: Room<S, V, E>): Promise<void> {
    const pending = room.pendingSave;
    if (!pending) return;
    await pending;
    if (room.pendingSave === pending) room.pendingSave = null;
  }

  function dispatch(room: Room<S, V, E>, action: A): E[] {
    const result = adapter.reduce(room.state, action, Date.now());
    room.state = result.state;
    commit(room, result.events);
    return result.events;
  }

  /* ---------------------------------------------------------------- */
  /* Planification : chrono serveur + bots                            */
  /* ---------------------------------------------------------------- */

  function schedule(room: Room<S, V, E>) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    if (room.botTimer) clearTimeout(room.botTimer);
    room.botTimer = null;

    const deadline = adapter.nextDeadline(room.state);
    if (deadline !== null) {
      const delay = Math.max(30, deadline - Date.now() + 40);
      room.timer = setTimeout(() => {
        room.timer = null;
        const result = adapter.reduce(room.state, adapter.tickAction, Date.now());
        room.state = result.state;
        commit(room, result.events);
      }, delay);
      room.timer.unref?.();
    }

    scheduleBot(room);
  }

  function scheduleBot(room: Room<S, V, E>) {
    const botId = adapter.botPendingPlayerId(room.state);
    if (!botId) {
      room.botDueAt = null;
      room.botVersion = null;
      return;
    }

    const delay = BOT_MIN_DELAY + Math.random() * (BOT_MAX_DELAY - BOT_MIN_DELAY);
    const versionAtSchedule = adapter.version(room.state);
    room.botDueAt = Date.now() + delay;
    room.botVersion = versionAtSchedule;

    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      if (adapter.version(room.state) !== versionAtSchedule) return;
      playBot(room, botId, versionAtSchedule);
    }, delay);
    room.botTimer.unref?.();
  }

  /** Joue le coup du bot, si l'état n'a pas bougé depuis qu'on l'a décidé. */
  function playBot(room: Room<S, V, E>, botId: string, expectedVersion: number): boolean {
    if (adapter.version(room.state) !== expectedVersion) return false;
    const action = adapter.decideBot(room.state, botId);
    if (!action) return false;
    const result = adapter.reduce(room.state, action, Date.now());
    if (adapter.version(result.state) === adapter.version(room.state)) return false;
    room.state = result.state;
    commit(room, result.events);
    return true;
  }

  /**
   * Rattrape le temps écoulé sans minuterie vivante.
   *
   * Sur un hébergeur sans serveur, la fonction se fige dès la réponse envoyée :
   * le chrono du tour et les bots, qui reposent sur des `setTimeout`, ne
   * s'exécutent jamais. La partie paraît alors gelée — et c'est ressenti comme
   * une perte de connexion. À chaque requête entrante, on rejoue donc ici tout
   * ce qui aurait dû se produire entre-temps.
   *
   * La boucle est bornée : une salle laissée de côté une nuit entière ne doit
   * pas rejouer mille tours d'un coup à la première visite.
   */
  function catchUp(room: Room<S, V, E>): boolean {
    let moved = false;
    for (let guard = 0; guard < 60; guard += 1) {
      const now = Date.now();

      const deadline = adapter.nextDeadline(room.state);
      if (deadline !== null && deadline <= now) {
        const result = adapter.reduce(room.state, adapter.tickAction, now);
        if (adapter.version(result.state) !== adapter.version(room.state)) {
          room.state = result.state;
          commit(room, result.events);
          moved = true;
          continue;
        }
      }

      const botId = adapter.botPendingPlayerId(room.state);
      if (botId) {
        // Échéance absente ou décidée pour un état qui a changé depuis : la
        // minuterie est morte avec l'instance précédente, on en repose une.
        if (room.botDueAt === null || room.botVersion !== adapter.version(room.state)) {
          scheduleBot(room);
        } else if (room.botDueAt <= now && playBot(room, botId, room.botVersion)) {
          moved = true;
          continue;
        }
      }
      break;
    }
    return moved;
  }

  /* ---------------------------------------------------------------- */
  /* Joueurs                                                          */
  /* ---------------------------------------------------------------- */

  function joinRoom(
    room: Room<S, V, E>,
    name: string,
    avatar: string,
  ): JoinOutcome | JoinFailure {
    const joinable = adapter.joinability(room.state);
    if (!joinable.ok) return { ok: false, error: joinable.error };

    const playerId = generatePlayerId();
    const token = generateToken();
    room.tokens.set(token, playerId);
    room.state = adapter.addPlayer(room.state, { id: playerId, name, avatar });
    commit(room, []);
    return { ok: true, token, playerId };
  }

  function requireHost(room: Room<S, V, E>, requesterId: string | null): string | null {
    const host = adapter.players(room.state).find((player) => player.isHost);
    if (!host || host.id !== requesterId) return 'Seul l’hôte peut faire cela.';
    return null;
  }

  function addBot(room: Room<S, V, E>, requesterId: string | null): string | null {
    const denied = requireHost(room, requesterId);
    if (denied) return 'Seul l’hôte peut ajouter un bot.';
    if (!adapter.isLobby(room.state)) return 'La partie a déjà commencé.';
    const joinable = adapter.joinability(room.state);
    if (!joinable.ok) return joinable.error;

    const index = adapter.players(room.state).filter((player) => player.isBot).length;
    const id = `bot_${generatePlayerId().slice(3)}`;
    room.state = adapter.addPlayer(room.state, {
      id,
      name: adapter.botNames[index % adapter.botNames.length],
      avatar: adapter.botAvatars[index % adapter.botAvatars.length],
      isBot: true,
    });
    commit(room, []);
    return null;
  }

  function kickPlayer(
    room: Room<S, V, E>,
    requesterId: string | null,
    targetId: string,
  ): string | null {
    const denied = requireHost(room, requesterId);
    if (denied) return 'Seul l’hôte peut retirer un joueur.';
    if (!adapter.isLobby(room.state)) return 'Impossible en cours de partie.';
    if (targetId === requesterId) return 'Vous ne pouvez pas vous retirer vous-même.';

    room.state = adapter.removePlayer(room.state, targetId);
    for (const [token, playerId] of room.tokens) {
      if (playerId === targetId) room.tokens.delete(token);
    }
    commit(room, []);
    return null;
  }

  /**
   * Départ volontaire. Dans le salon, la place est libérée immédiatement ;
   * en cours de partie le joueur reste à table — il peut revenir — mais il est
   * marqué hors ligne pour que son tour n'immobilise pas les autres.
   */
  function leaveRoom(room: Room<S, V, E>, playerId: string): string | null {
    if (adapter.isLobby(room.state)) {
      room.state = adapter.removePlayer(room.state, playerId);
      for (const [token, id] of room.tokens) {
        if (id === playerId) room.tokens.delete(token);
      }
    } else {
      room.state = adapter.setConnected(room.state, playerId, false);
    }
    commit(room, []);
    return null;
  }

  function updateSettings(
    room: Room<S, V, E>,
    requesterId: string | null,
    raw: unknown,
  ): string | null {
    const denied = requireHost(room, requesterId);
    if (denied) return 'Seul l’hôte peut modifier les réglages.';
    if (!adapter.isLobby(room.state)) return 'Réglages verrouillés en cours de partie.';

    const result = adapter.applySettings(room.state, raw);
    if (result.error) return result.error;
    room.state = result.state;
    commit(room, []);
    return null;
  }

  function canStart(room: Room<S, V, E>): boolean {
    return adapter.canStart(room.state);
  }

  /* ---------------------------------------------------------------- */
  /* Présence                                                         */
  /* ---------------------------------------------------------------- */

  function attach(room: Room<S, V, E>, subscriber: Subscriber<V, E>) {
    room.subscribers.add(subscriber);
    if (subscriber.playerId) {
      const pending = room.dropTimers.get(subscriber.playerId);
      if (pending) {
        clearTimeout(pending);
        room.dropTimers.delete(subscriber.playerId);
      }
      const before = room.state;
      room.state = adapter.setConnected(room.state, subscriber.playerId, true);
      if (before !== room.state) commit(room, []);
    }
    const view = adapter.buildView(room.state, subscriber.playerId, Date.now());
    subscriber.send({ type: 'sync', view, events: [], seq: room.seq });
  }

  function detach(room: Room<S, V, E>, subscriber: Subscriber<V, E>) {
    room.subscribers.delete(subscriber);
    const playerId = subscriber.playerId;
    if (!playerId) return;

    const stillOpen = Array.from(room.subscribers).some(
      (entry) => entry.playerId === playerId,
    );
    if (stillOpen) return;

    // Une coupure de flux n'est pas une absence : on laisse au navigateur le
    // temps de se reconnecter avant d'en tirer la moindre conséquence.
    const existing = room.dropTimers.get(playerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      room.dropTimers.delete(playerId);
      dropPlayer(room, playerId);
    }, PRESENCE_GRACE_MS);
    timer.unref?.();
    room.dropTimers.set(playerId, timer);
  }

  /**
   * Le joueur n'est pas revenu : on le déclare absent, et dans le salon
   * d'attente on libère sa place.
   */
  function dropPlayer(room: Room<S, V, E>, playerId: string) {
    // Revenu entre-temps : il n'a jamais été absent.
    const back = Array.from(room.subscribers).some((entry) => entry.playerId === playerId);
    if (back) return;

    const lobby = adapter.isLobby(room.state);
    if (lobby) {
      room.state = adapter.removePlayer(room.state, playerId);
      for (const [token, id] of room.tokens) {
        if (id === playerId) room.tokens.delete(token);
      }
    } else {
      room.state = adapter.setConnected(room.state, playerId, false);
    }
    commit(room, []);
  }

  /**
   * Signe de vie par la voie HTTP.
   *
   * Un joueur qui envoie un coup ou vient lire l'état est là, même si son flux
   * temps réel est coupé — ce qui arrive sans cesse derrière un proxy ou en
   * passant du wifi aux données mobiles. Sans cela il restait marqué absent,
   * et son tour expirait en huit secondes au lieu de soixante.
   */
  function touchPlayer(room: Room<S, V, E>, playerId: string | null) {
    if (!playerId) return;
    const pending = room.dropTimers.get(playerId);
    if (pending) {
      clearTimeout(pending);
      room.dropTimers.delete(playerId);
    }
    const before = room.state;
    room.state = adapter.setConnected(room.state, playerId, true);
    if (before !== room.state) commit(room, []);
  }

  /** Sonde publique d'une salle : jamais de main, jamais de jeton. */
  function probe(room: Room<S, V, E>) {
    const players = adapter.players(room.state);
    const joinable = adapter.joinability(room.state);
    return {
      exists: true as const,
      code: room.code,
      game: adapter.key,
      phase: adapter.phase(room.state),
      playerCount: players.length,
      capacity: adapter.capacity(room.state),
      joinable: joinable.ok,
    };
  }

  return {
    adapter,
    createRoom,
    findRoom,
    playerIdForToken,
    broadcast,
    commit,
    dispatch,
    joinRoom,
    addBot,
    kickPlayer,
    leaveRoom,
    updateSettings,
    canStart,
    attach,
    detach,
    touchPlayer,
    flush,
    probe,
    buildView: (room: Room<S, V, E>, viewerId: string | null) =>
      adapter.buildView(room.state, viewerId, Date.now()),
  };
}
