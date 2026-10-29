// Local backend: the whole database lives in localStorage and every open tab
// sees changes through the "storage" event, so two tabs behave like two
// people. The current user is kept in sessionStorage, so each tab can be a
// different account. Swap this file for a Supabase client to go online.
import { useSyncExternalStore } from "react";
import { BOT_USERS, ROOMS } from "./seed";
import type {
  ChatMessage,
  DB,
  GameSession,
  Report,
  User,
} from "./types";

const DB_KEY = "cp_db_v1";
const SESSION_KEY = "cp_session";
export const REPORTS_TO_SUSPEND = 10;
const MAX_MESSAGES = 600;

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

function freshDB(): DB {
  const users: Record<string, User> = {};
  for (const bot of BOT_USERS) users[bot.id] = bot;
  return {
    version: 1,
    users,
    requests: [],
    friendships: [],
    blocks: [],
    reports: [],
    messages: [],
    rooms: ROOMS,
    games: [],
    queue: [],
    strangers: [],
    presence: {},
    reads: {},
  };
}

let cache: DB | null = null;
const listeners = new Set<() => void>();

function read(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    cache = raw ? (JSON.parse(raw) as DB) : freshDB();
  } catch {
    cache = freshDB();
  }
  return cache;
}

function emit() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === DB_KEY) {
      cache = null;
      emit();
    }
  });
}

export function mutate<T>(fn: (db: DB) => T): T {
  cache = null;
  const db = structuredClone(read());
  const result = fn(db);
  if (db.messages.length > MAX_MESSAGES) {
    db.messages = db.messages.slice(db.messages.length - MAX_MESSAGES);
  }
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    throw new Error("Storage is full. Delete some old photos or voice notes.");
  }
  cache = db;
  emit();
  return result;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDB() {
  return read();
}

export function useDB() {
  return useSyncExternalStore(subscribe, read);
}

// ---------- session ----------

const sessionListeners = new Set<() => void>();

export function getSessionId() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setSessionId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: session lasts only in memory */
  }
  sessionListeners.forEach((listener) => listener());
}

export function useSessionId() {
  return useSyncExternalStore(
    (listener) => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    getSessionId,
  );
}

// ---------- helpers ----------

export const dmId = (a: string, b: string) => `dm:${[a, b].sort().join(":")}`;
export const otherInDm = (convId: string, me: string) =>
  convId.slice(3).split(":").find((id) => id !== me) ?? me;

export function areFriends(db: DB, a: string, b: string) {
  return db.friendships.some((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));
}

export function friendIds(db: DB, me: string) {
  return db.friendships
    .filter((f) => f.a === me || f.b === me)
    .map((f) => (f.a === me ? f.b : f.a));
}

export function hasBlocked(db: DB, by: string, target: string) {
  return db.blocks.some((b) => b.by === by && b.target === target);
}

export function eitherBlocked(db: DB, a: string, b: string) {
  return hasBlocked(db, a, b) || hasBlocked(db, b, a);
}

export function isOnline(db: DB, id: string) {
  const user = db.users[id];
  if (user?.isBot) return true;
  return Date.now() - (db.presence[id] ?? 0) < 45_000;
}

export function initialsOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(name: string) {
  return name.trim().replace(/^@/, "").toLowerCase();
}

function findByUsername(db: DB, username: string) {
  const needle = normalizeUsername(username);
  return Object.values(db.users).find((u) => u.username === needle);
}

async function hashPassword(username: string, password: string) {
  const data = new TextEncoder().encode(`coupleplay:${username}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const ADJECTIVES = ["Happy", "Sleepy", "Brave", "Fuzzy", "Lucky", "Sunny", "Cosy", "Witty", "Zippy", "Mellow", "Jolly", "Swift"];
const ANIMALS = ["Panda", "Otter", "Koala", "Tiger", "Bunny", "Falcon", "Mango", "Pixel", "Comet", "Lotus", "Penguin", "Fox"];

export function randomGuestName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective}${animal}${Math.floor(100 + Math.random() * 900)}`;
}

function newUser(fields: Partial<User> & { username: string; displayName: string }): User {
  return {
    id: uid(),
    hue: Math.floor(Math.random() * 360),
    isGuest: false,
    hearts: 120,
    streak: 0,
    ownedThemes: ["rose", "classic"],
    appTheme: "rose",
    chatTheme: "classic",
    createdAt: Date.now(),
    ...fields,
  };
}

function welcome(db: DB, user: User) {
  db.requests.push({ id: uid(), from: "bot-priya", to: user.id, createdAt: Date.now() });
}

// ---------- auth ----------

export const api = {
  async continueAsGuest() {
    const user = mutate((db) => {
      let name = randomGuestName();
      while (findByUsername(db, name)) name = randomGuestName();
      const guest = newUser({ username: name.toLowerCase(), displayName: name, isGuest: true });
      db.users[guest.id] = guest;
      welcome(db, guest);
      return guest;
    });
    setSessionId(user.id);
    return user;
  },

  async signUp(usernameRaw: string, password: string, displayName?: string) {
    const username = normalizeUsername(usernameRaw);
    if (!USERNAME_RE.test(username)) throw new Error("Username: 3-20 letters, numbers or _");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    const passwordHash = await hashPassword(username, password);
    const user = mutate((db) => {
      if (findByUsername(db, username)) throw new Error("That username is taken");
      const created = newUser({ username, displayName: displayName?.trim() || usernameRaw.trim(), passwordHash });
      db.users[created.id] = created;
      welcome(db, created);
      return created;
    });
    setSessionId(user.id);
    return user;
  },

  // Turns the current guest into a real account and keeps all friends and chats.
  async upgradeGuest(userId: string, usernameRaw: string, password: string) {
    const username = normalizeUsername(usernameRaw);
    if (!USERNAME_RE.test(username)) throw new Error("Username: 3-20 letters, numbers or _");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    const passwordHash = await hashPassword(username, password);
    mutate((db) => {
      const taken = findByUsername(db, username);
      if (taken && taken.id !== userId) throw new Error("That username is taken");
      const user = db.users[userId];
      user.username = username;
      user.passwordHash = passwordHash;
      user.isGuest = false;
      user.hearts += 50;
    });
  },

  async logIn(usernameRaw: string, password: string) {
    const username = normalizeUsername(usernameRaw);
    const user = findByUsername(getDB(), username);
    if (!user || user.isGuest || !user.passwordHash) throw new Error("No account with that username");
    if ((await hashPassword(username, password)) !== user.passwordHash) throw new Error("Wrong password");
    setSessionId(user.id);
    return user;
  },

  logOut() {
    setSessionId(null);
  },

  heartbeat(me: string) {
    mutate((db) => {
      db.presence[me] = Date.now();
    });
  },

  updateProfile(me: string, patch: { displayName?: string; username?: string; hue?: number }) {
    mutate((db) => {
      const user = db.users[me];
      if (patch.displayName !== undefined) {
        const name = patch.displayName.trim();
        if (name.length < 2 || name.length > 24) throw new Error("Name must be 2-24 characters");
        user.displayName = name;
      }
      if (patch.username !== undefined) {
        const username = normalizeUsername(patch.username);
        if (!USERNAME_RE.test(username)) throw new Error("Username: 3-20 letters, numbers or _");
        const taken = findByUsername(db, username);
        if (taken && taken.id !== me) throw new Error("That username is taken");
        if (user.passwordHash && username !== user.username) {
          throw new Error("Username is locked after sign up");
        }
        user.username = username;
      }
      if (patch.hue !== undefined) user.hue = patch.hue;
    });
  },

  // ---------- friends ----------

  sendFriendRequest(me: string, usernameRaw: string) {
    return mutate((db) => {
      const target = findByUsername(db, usernameRaw);
      if (!target) throw new Error(`No one is called @${normalizeUsername(usernameRaw)}`);
      if (target.id === me) throw new Error("That's you!");
      if (target.suspended) throw new Error("This account is suspended");
      if (hasBlocked(db, me, target.id)) throw new Error("Unblock them first");
      if (hasBlocked(db, target.id, me)) throw new Error("You can't add this person");
      if (areFriends(db, me, target.id)) throw new Error("You're already friends");
      const reverse = db.requests.find((r) => r.from === target.id && r.to === me);
      if (reverse) {
        db.requests = db.requests.filter((r) => r !== reverse);
        db.friendships.push({ id: uid(), a: me, b: target.id, createdAt: Date.now() });
        return { target, accepted: true };
      }
      if (db.requests.some((r) => r.from === me && r.to === target.id)) {
        throw new Error("Request already sent");
      }
      db.requests.push({ id: uid(), from: me, to: target.id, createdAt: Date.now() });
      return { target, accepted: false };
    });
  },

  acceptRequest(requestId: string) {
    mutate((db) => {
      const request = db.requests.find((r) => r.id === requestId);
      if (!request) return;
      db.requests = db.requests.filter((r) => r.id !== requestId);
      if (!areFriends(db, request.from, request.to)) {
        db.friendships.push({ id: uid(), a: request.from, b: request.to, createdAt: Date.now() });
      }
    });
  },

  declineRequest(requestId: string) {
    mutate((db) => {
      db.requests = db.requests.filter((r) => r.id !== requestId);
    });
  },

  unfriend(me: string, other: string) {
    mutate((db) => {
      db.friendships = db.friendships.filter(
        (f) => !((f.a === me && f.b === other) || (f.a === other && f.b === me)),
      );
      const user = db.users[me];
      if (user.partnerId === other) user.partnerId = undefined;
    });
  },

  setPartner(me: string, other: string | undefined) {
    mutate((db) => {
      db.users[me].partnerId = other;
    });
  },

  block(me: string, target: string, reason: string) {
    mutate((db) => {
      if (hasBlocked(db, me, target)) return;
      db.blocks.push({ by: me, target, reason, createdAt: Date.now() });
      db.friendships = db.friendships.filter(
        (f) => !((f.a === me && f.b === target) || (f.a === target && f.b === me)),
      );
      db.requests = db.requests.filter(
        (r) => !((r.from === me && r.to === target) || (r.from === target && r.to === me)),
      );
      for (const chat of db.strangers) {
        if (chat.open && ((chat.a === me && chat.b === target) || (chat.a === target && chat.b === me))) {
          chat.open = false;
        }
      }
      if (db.users[me].partnerId === target) db.users[me].partnerId = undefined;
    });
  },

  unblock(me: string, target: string) {
    mutate((db) => {
      db.blocks = db.blocks.filter((b) => !(b.by === me && b.target === target));
    });
  },

  // A person is suspended once REPORTS_TO_SUSPEND different people report them.
  report(me: string, target: string, reason: string, details?: string) {
    return mutate((db) => {
      if (db.reports.some((r) => r.by === me && r.target === target)) {
        throw new Error("You already reported this person");
      }
      const report: Report = { id: uid(), by: me, target, reason, details, createdAt: Date.now() };
      db.reports.push(report);
      const reporters = new Set(db.reports.filter((r) => r.target === target).map((r) => r.by));
      if (reporters.size >= REPORTS_TO_SUSPEND && db.users[target]) {
        db.users[target].suspended = true;
      }
      return reporters.size;
    });
  },

  // ---------- chat ----------

  sendMessage(me: string, convId: string, message: Omit<ChatMessage, "id" | "convId" | "from" | "createdAt">) {
    return mutate((db) => {
      if (db.users[me]?.suspended) throw new Error("Your account is suspended");
      if (convId.startsWith("dm:")) {
        const other = otherInDm(convId, me);
        if (eitherBlocked(db, me, other)) throw new Error("You can't message this person");
      }
      if (convId.startsWith("str:")) {
        const chat = db.strangers.find((c) => `str:${c.id}` === convId);
        if (!chat?.open) throw new Error("This chat has ended");
      }
      const created: ChatMessage = { id: uid(), convId, from: me, createdAt: Date.now(), ...message };
      db.messages.push(created);
      db.reads[`${me}|${convId}`] = created.createdAt;
      return created;
    });
  },

  deleteMessage(me: string, messageId: string) {
    mutate((db) => {
      db.messages = db.messages.filter((m) => !(m.id === messageId && m.from === me));
    });
  },

  markRead(me: string, convId: string) {
    const key = `${me}|${convId}`;
    const db = getDB();
    const last = [...db.messages].reverse().find((m) => m.convId === convId);
    if (!last || (db.reads[key] ?? 0) >= last.createdAt) return;
    mutate((next) => {
      next.reads[key] = last.createdAt;
    });
  },

  // ---------- hearts & themes ----------

  completeDailyTask(me: string) {
    return mutate((db) => {
      const user = db.users[me];
      const today = todayKey();
      if (user.lastDailyTask === today) return false;
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      user.streak = user.lastDailyTask === yesterday ? user.streak + 1 : 1;
      user.lastDailyTask = today;
      user.hearts += 10;
      return true;
    });
  },

  addHearts(me: string, amount: number) {
    mutate((db) => {
      if (db.users[me]) db.users[me].hearts += amount;
    });
  },

  buyTheme(me: string, themeId: string, price: number) {
    mutate((db) => {
      const user = db.users[me];
      if (user.ownedThemes.includes(themeId)) return;
      if (user.hearts < price) throw new Error(`You need ${price - user.hearts} more hearts`);
      user.hearts -= price;
      user.ownedThemes.push(themeId);
    });
  },

  applyTheme(me: string, kind: "app" | "chat", themeId: string) {
    mutate((db) => {
      const user = db.users[me];
      if (!user.ownedThemes.includes(themeId)) throw new Error("Buy this theme first");
      if (kind === "app") user.appTheme = themeId;
      else user.chatTheme = themeId;
    });
  },

  // ---------- strangers ----------

  findStranger(me: string) {
    return mutate((db) => {
      db.queue = db.queue.filter((q) => Date.now() - q.since < 60_000 || q.userId === me);
      const match = db.queue.find(
        (q) => q.kind === "chat" && q.userId !== me && !eitherBlocked(db, me, q.userId),
      );
      if (match) {
        db.queue = db.queue.filter((q) => q !== match && q.userId !== me);
        const chat = { id: uid(), a: match.userId, b: me, open: true, createdAt: Date.now() };
        db.strangers.push(chat);
        return chat;
      }
      if (!db.queue.some((q) => q.userId === me && q.kind === "chat")) {
        db.queue.push({ userId: me, kind: "chat", since: Date.now() });
      }
      return null;
    });
  },

  startBotStranger(me: string, botId: string) {
    return mutate((db) => {
      db.queue = db.queue.filter((q) => q.userId !== me);
      const chat = { id: uid(), a: botId, b: me, open: true, createdAt: Date.now() };
      db.strangers.push(chat);
      return chat;
    });
  },

  leaveQueue(me: string) {
    mutate((db) => {
      db.queue = db.queue.filter((q) => q.userId !== me);
    });
  },

  endStranger(chatId: string) {
    mutate((db) => {
      const chat = db.strangers.find((c) => c.id === chatId);
      if (chat) chat.open = false;
    });
  },

  // ---------- games ----------

  createGame(game: string, players: string[], host: string, state: unknown, convId?: string) {
    return mutate((db) => {
      const id = uid();
      const session: GameSession = {
        id,
        game,
        players,
        host,
        status: "playing",
        state,
        winner: null,
        convId: convId ?? `game:${id}`,
        rev: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      db.games.push(session);
      db.games = db.games.filter((g) => g.status !== "finished" || Date.now() - g.updatedAt < 86_400_000);
      return session;
    });
  },

  updateGame(id: string, patch: (session: GameSession) => void) {
    return mutate((db) => {
      const session = db.games.find((g) => g.id === id);
      if (!session) throw new Error("Game not found");
      patch(session);
      session.rev += 1;
      session.updatedAt = Date.now();
      return session;
    });
  },

  findGameMatch(me: string, game: string) {
    return mutate((db) => {
      db.queue = db.queue.filter((q) => Date.now() - q.since < 60_000 || q.userId === me);
      const match = db.queue.find(
        (q) => q.kind === "game" && q.game === game && q.userId !== me && !eitherBlocked(db, me, q.userId),
      );
      if (match) {
        db.queue = db.queue.filter((q) => q !== match && q.userId !== me);
        return match.userId;
      }
      if (!db.queue.some((q) => q.userId === me && q.kind === "game")) {
        db.queue.push({ userId: me, kind: "game", game, since: Date.now() });
      }
      return null;
    });
  },
};
