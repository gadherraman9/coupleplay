// Supabase sync layer. The app keeps working on one in-memory DB snapshot;
// this file loads it from Supabase, keeps it live with realtime events and
// turns every local change into row inserts, updates and deletes.
import { createClient } from "@supabase/supabase-js";
import type { DB, User } from "./types";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const REMOTE = Boolean(URL && KEY);
export const supabase = REMOTE ? createClient(URL!, KEY!) : null;

type Row = Record<string, unknown> & { id: string };

interface Spec {
  table: string;
  entries: (db: DB) => [string, unknown][];
  toRow: (key: string, value: any) => Row;
  apply: (db: DB, row: any) => DB;
  remove: (db: DB, id: string) => DB;
}

function listSpec<T>(
  coll: "requests" | "friendships" | "blocks" | "reports" | "strangers" | "games" | "messages" | "queue",
  table: string,
  keyOf: (item: T) => string,
  columns: (item: T) => Record<string, unknown>,
): Spec {
  return {
    table,
    entries: (db) => (db[coll] as T[]).map((item) => [keyOf(item), item]),
    toRow: (key, item: T) => ({ id: key, ...columns(item), data: item }),
    apply: (db, row) => {
      const list = db[coll] as T[];
      const item = row.data as T;
      const index = list.findIndex((x) => keyOf(x) === row.id);
      const next = index >= 0 ? list.map((x, i) => (i === index ? item : x)) : [...list, item];
      if (coll === "messages") (next as { createdAt: number }[]).sort((a, b) => a.createdAt - b.createdAt);
      return { ...db, [coll]: next };
    },
    remove: (db, id) => ({ ...db, [coll]: (db[coll] as T[]).filter((x) => keyOf(x) !== id) }),
  };
}

function recordSpec(coll: "presence" | "reads", table: string, extra: (key: string) => Record<string, unknown>): Spec {
  return {
    table,
    entries: (db) => Object.entries(db[coll]),
    toRow: (key, at: number) => ({ id: key, at, ...extra(key) }),
    apply: (db, row) => ({ ...db, [coll]: { ...db[coll], [row.id]: Number(row.at) } }),
    remove: (db, id) => {
      const next = { ...db[coll] };
      delete next[id];
      return { ...db, [coll]: next };
    },
  };
}

// Order matters: rows other rows depend on are written first.
export const SPECS: Spec[] = [
  {
    table: "profiles",
    entries: (db) => Object.entries(db.users),
    toRow: (key, user: User) => {
      const { suspended: _ignored, passwordHash: _hash, ...data } = user;
      return { id: key, username: user.username, data };
    },
    apply: (db, row) => ({
      ...db,
      users: { ...db.users, [row.id]: { ...row.data, username: row.username, suspended: row.suspended } },
    }),
    remove: (db, id) => {
      const users = { ...db.users };
      delete users[id];
      return { ...db, users };
    },
  },
  listSpec<DB["strangers"][number]>("strangers", "strangers", (s) => s.id, (s) => ({ a: s.a, b: s.b })),
  listSpec<DB["games"][number]>("games", "games", (g) => g.id, (g) => ({ host: g.host, players: g.players })),
  listSpec<DB["requests"][number]>("requests", "friend_requests", (r) => r.id, (r) => ({ from_id: r.from, to_id: r.to })),
  listSpec<DB["friendships"][number]>("friendships", "friendships", (f) => f.id, (f) => ({ a: f.a, b: f.b })),
  listSpec<DB["blocks"][number]>("blocks", "blocks", (b) => `${b.by}|${b.target}`, (b) => ({ by_id: b.by, target_id: b.target })),
  listSpec<DB["reports"][number]>("reports", "reports", (r) => r.id, (r) => ({ by_id: r.by, target_id: r.target })),
  listSpec<DB["messages"][number]>("messages", "messages", (m) => m.id, (m) => ({ conv_id: m.convId, from_id: m.from })),
  listSpec<DB["queue"][number]>("queue", "queue", (q) => q.userId, () => ({})),
  recordSpec("presence", "presence", () => ({})),
  // conv_id lets the other people in a chat read these rows (ticks).
  recordSpec("reads", "reads", (key) => ({ user_id: key.split("|")[0], conv_id: key.split("|")[1] })),
];

export async function loadAll(base: DB): Promise<DB> {
  let db = { ...base, users: { ...base.users } };
  for (const spec of SPECS) {
    let query = supabase!.from(spec.table).select("*");
    if (spec.table === "messages") query = query.order("created_at", { ascending: false }).limit(1000);
    const { data, error } = await query;
    if (error) throw new Error(`${spec.table}: ${error.message}`);
    const rows = spec.table === "messages" ? [...(data ?? [])].reverse() : data ?? [];
    for (const row of rows) db = spec.apply(db, row);
  }
  return db;
}

let queue: Promise<void> = Promise.resolve();

// Messages written locally but not yet stored on the server (clock icon).
const pending = new Set<string>();
const pendingListeners = new Set<() => void>();
let pendingVersion = 0;
const pendingChanged = () => {
  pendingVersion += 1;
  pendingListeners.forEach((listener) => listener());
};
export const isPendingMessage = (id: string) => pending.has(id);
export const pendingStore = {
  subscribe: (listener: () => void) => {
    pendingListeners.add(listener);
    return () => pendingListeners.delete(listener);
  },
  version: () => pendingVersion,
};

// Before schema-v2.sql is run the reads table has no conv_id column.
let readsHaveConv = true;
async function write(kind: "insert" | "update", table: string, row: Row) {
  const send = (r: Row) => {
    if (kind === "insert") return supabase!.from(table).insert(r);
    const { id, ...fields } = r;
    return supabase!.from(table).update(fields).eq("id", id);
  };
  let current = row;
  if (table === "reads" && !readsHaveConv) {
    const { conv_id: _c, ...rest } = row;
    current = rest as Row;
  }
  let { error } = await send(current);
  if (error && table === "reads" && readsHaveConv && /conv_id/.test(error.message)) {
    readsHaveConv = false;
    const { conv_id: _c, ...rest } = row;
    ({ error } = await send(rest as Row));
  }
  return error;
}

// Sends what changed between two snapshots, in order, one batch at a time.
export function pushDiff(before: DB, after: DB, onError: (message: string) => void) {
  const inserts: [Spec, Row][] = [];
  const updates: [Spec, Row][] = [];
  const deletes: [Spec, string][] = [];
  for (const spec of SPECS) {
    const old = new Map(spec.entries(before).map(([k, v]) => [k, JSON.stringify(v)]));
    const now = spec.entries(after);
    const seen = new Set<string>();
    for (const [key, value] of now) {
      seen.add(key);
      const json = JSON.stringify(value);
      if (!old.has(key)) inserts.push([spec, spec.toRow(key, value)]);
      else if (old.get(key) !== json) updates.push([spec, spec.toRow(key, value)]);
    }
    for (const key of old.keys()) if (!seen.has(key)) deletes.push([spec, key]);
  }
  if (!inserts.length && !updates.length && !deletes.length) return;
  const newMessages = inserts.filter(([spec]) => spec.table === "messages").map(([, row]) => row.id);
  if (newMessages.length) {
    newMessages.forEach((id) => pending.add(id));
    pendingChanged();
  }

  queue = queue.then(async () => {
    for (const [spec, row] of inserts) {
      const error = await write("insert", spec.table, row);
      if (error) onError(friendly(error.message));
      if (spec.table === "messages" && pending.delete(row.id)) pendingChanged();
    }
    for (const [spec, row] of updates) {
      const error = await write("update", spec.table, row);
      if (error) onError(friendly(error.message));
    }
    for (const [spec, id] of deletes) {
      const { error } = await supabase!.from(spec.table).delete().eq("id", id);
      if (error) console.warn(`delete ${spec.table}`, error.message);
    }
  });
}

function friendly(message: string) {
  if (/row-level security/i.test(message)) return "You're not allowed to do that";
  if (/duplicate key/i.test(message)) return "That already exists";
  return message;
}

export function subscribeRealtime(onRow: (spec: Spec, row: any, deleted: boolean) => void) {
  const channel = supabase!.channel("coupleplay-db");
  for (const spec of SPECS) {
    if (spec.table === "reports") continue;
    channel.on("postgres_changes", { event: "*", schema: "public", table: spec.table }, (payload) => {
      if (payload.eventType === "DELETE") onRow(spec, payload.old, true);
      else onRow(spec, payload.new, false);
    });
  }
  channel.subscribe();
  return () => {
    void supabase!.removeChannel(channel);
  };
}

// Accounts are username + password; Supabase needs an email, so we make one.
export const emailFor = (username: string) => `${username}@users.coupleplay.app`;

// ---------- private media ----------

const folderOf = (convId: string) => convId.replace(/:/g, "_");

export async function uploadMedia(convId: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const path = `${folderOf(convId)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase!.storage.from("media").upload(path, blob, { contentType: blob.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return `sb:${path}`;
}

const signed = new Map<string, Promise<string>>();

export function signedUrl(src: string) {
  const path = src.slice(3);
  if (!signed.has(path)) {
    signed.set(
      path,
      supabase!.storage
        .from("media")
        .createSignedUrl(path, 60 * 60 * 12)
        .then(({ data, error }) => {
          if (error || !data) {
            signed.delete(path);
            throw new Error(error?.message ?? "Couldn't load media");
          }
          return data.signedUrl;
        }),
    );
  }
  return signed.get(path)!;
}

export async function deleteMedia(src: string) {
  if (!src.startsWith("sb:")) return;
  await supabase!.storage.from("media").remove([src.slice(3)]);
}
