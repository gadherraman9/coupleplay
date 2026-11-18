import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { DB, GameSession, User } from "../src/backend/types";
import {
  COUPLE_XP_PLAY, coupleProgress, coupleRank, coupleReceipts, finalizeGameUpdate,
  MAX_COUPLE_RECENT, MAX_GAME_HIGHLIGHTS, MAX_HIGHLIGHT_LENGTH, recordGameProgress,
} from "../src/coupleProgress";
import {
  BOARD_GAMES, COMPLETION_HEARTS, dailyDare, dailyDareState, dateStreak, dayKey,
  DARE_HEARTS, DARE_XP, LEVEL_REWARD, REGISTERED_GAME_IDS, SOLO_GAME_IDS,
  streakBonus, WIN_HEARTS, XP_PLAY, XP_WIN,
} from "../src/progress";

// Only source text is inspected for catalog parity: never initialize game views,
// React hooks, localStorage, Supabase or any browser APIs in this test module.
const at = Date.parse("2026-11-12T12:00:00Z");
const day = 86_400_000;
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function user(id: string, patch: Partial<User> = {}): User {
  return {
    id, username: id, displayName: id, hue: 0, isGuest: false, hearts: 120,
    streak: 0, ownedThemes: [], appTheme: "rose", chatTheme: "classic", createdAt: at - day,
    ...patch,
  };
}

function game(id: string, patch: Partial<GameSession> = {}): GameSession {
  return {
    id, game: "ludo", players: ["a", "b"], host: "a", status: "finished",
    state: { players: ["a", "b"], log: "a|finished" }, winner: "a", convId: `game:${id}`,
    rev: 5, createdAt: at - 1000, updatedAt: at, finishedAt: at, playedBy: ["a", "b"], ...patch,
  };
}

function fixture(games: GameSession[] = [game("one")]): Pick<DB, "users" | "games"> {
  return {
    users: { a: user("a", { partnerId: "b" }), b: user("b", { partnerId: "a" }), c: user("c") },
    games,
  };
}

function claim(db: Pick<DB, "users" | "games">, id: string, me = "a", now = at) {
  const result = recordGameProgress(db, me, id, now);
  db.users[me] = result.user;
  return result.receipt;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

test("data-only registry and solo classification match every registered game", () => {
  const registry = source("src/games/registry.ts");
  const symbols = registry.match(/ONLINE_GAMES[^=]*=\s*\[([\s\S]*?)\]/)![1].match(/\w+/g)!;
  const imports = new Map([...registry.matchAll(/import\s+\{\s*(\w+)\s*\}\s+from\s+"\.\/(\w+)"/g)]
    .map((m) => [m[1], m[2]]));
  const ids: string[] = [];
  const solo: string[] = [];
  for (const symbol of symbols) {
    const text = source(`src/games/${imports.get(symbol)}.tsx`);
    const def = text.slice(text.indexOf(`export const ${symbol}`));
    const id = def.match(/\bid:\s*"([^"]+)"/)![1];
    ids.push(id);
    if (/soloOnly:\s*true/.test(def)) solo.push(id);
  }
  assert.deepEqual([...REGISTERED_GAME_IDS].sort(), ids.sort());
  assert.deepEqual([...SOLO_GAME_IDS].sort(), solo.sort());
  for (const id of ["fourinrow", "dots", "tictactoe"]) assert.ok(BOARD_GAMES.has(id));
});

test("reject missing, unfinished, unregistered and nonparticipant sessions without mutation", () => {
  for (const patch of [
    { status: "playing" as const }, { status: "waiting" as const }, { game: "not-a-game" },
    { players: ["b", "c"] }, { state: { players: ["b", "c"] } }, { winner: "outsider" },
  ]) {
    const db = freeze(fixture([game("one", patch)]));
    assert.throws(() => recordGameProgress(db, "a", "one", at));
    assert.equal(db.users.a.hearts, 120);
    assert.equal(db.users.a.gameReceipts, undefined);
  }
  assert.throws(() => recordGameProgress(fixture([]), "a", "missing", at), /not found/);
  assert.throws(() => recordGameProgress(fixture(), "missing", "one", at), /human/);
});

test("couple XP requires a recorded move from both partners, not just an invite", () => {
  for (const playedBy of [undefined, [], ["a"], ["b"]]) {
    const db = fixture([game("invite", { playedBy })]);
    assert.equal(claim(db, "invite").couple, undefined);
  }
  assert.equal(claim(fixture(), "one").couple?.xp, COUPLE_XP_PLAY);
});

test("pure reward reduction leaves both profiles and the game untouched", () => {
  const db = freeze(fixture());
  const result = recordGameProgress(db, "a", "one", at);
  assert.notEqual(result.user, db.users.a);
  assert.equal(db.users.a.hearts, 120);
  assert.equal(db.users.b.gameReceipts, undefined);
  assert.deepEqual(result.receipt.couple, { players: ["a", "b"], xp: COUPLE_XP_PLAY });
});

test("persisted receipts survive reload and game cleanup, returning exactly the same reward", () => {
  const db = fixture();
  const first = claim(db, "one");
  const saved = JSON.stringify(db.users.a);
  const loaded = JSON.parse(JSON.stringify(db)) as typeof db;
  loaded.games = [];
  const again = claim(loaded, "one", "a", at + 10 * day);
  assert.deepEqual(again, JSON.parse(JSON.stringify(first)));
  assert.equal(JSON.stringify(loaded.users.a), saved);
  assert.equal(loaded.users.a.gameStats!.ludo.played, 1);
  assert.equal(loaded.users.a.missions!.played, 1);
});

test("each participant receives one independent reward; no partner-profile write", () => {
  const db = fixture();
  const partnerBefore = JSON.stringify(db.users.b);
  claim(db, "one");
  assert.equal(JSON.stringify(db.users.b), partnerBefore);
  const meBefore = JSON.stringify(db.users.a);
  const loser = claim(db, "one", "b");
  assert.equal(JSON.stringify(db.users.a), meBefore);
  assert.equal(loser.outcome, "loss");
  assert.equal(loser.completionHearts, COMPLETION_HEARTS);
  assert.ok(loser.hearts >= COMPLETION_HEARTS);
  assert.ok(loser.xp >= XP_PLAY);
  assert.equal(loser.winHearts, 0);
  assert.equal(db.users.b.wins, 0);
  assert.equal(db.users.b.gameStats!.ludo.won, 0);
});

test("draw sentinel gives completion rewards, no win and resets current but not best streak", () => {
  const db = fixture([game("draw", { winner: "draw" })]);
  db.users.a.winStreak = 3;
  db.users.a.gameStats = { ludo: { played: 3, won: 3, winStreak: 3 } };
  const receipt = claim(db, "draw");
  assert.equal(receipt.outcome, "draw");
  assert.equal(receipt.winner, "draw");
  assert.ok(receipt.hearts >= COMPLETION_HEARTS);
  assert.ok(receipt.xp >= XP_PLAY);
  assert.equal(receipt.bonus, 0);
  assert.equal(db.users.a.winStreak, 0);
  assert.equal(db.users.a.bestWinStreak, 3);
  assert.equal(db.users.a.draws, 1);
  assert.deepEqual(db.users.a.gameStats!.ludo, { played: 4, won: 3, winStreak: 0, bestWinStreak: 3, draws: 1 });
  assert.equal(db.users.a.missions!.won, 0);
});

test("every registered game pays for completion, including solo and bot opponents", () => {
  for (const id of REGISTERED_GAME_IDS) {
    const solo = SOLO_GAME_IDS.has(id);
    const players = solo ? ["a"] : ["a", "ai:1"];
    const db = fixture([game(id, { game: id, players, state: { players }, winner: solo ? null : "ai:1" })]);
    const receipt = claim(db, id);
    assert.ok(receipt.hearts >= COMPLETION_HEARTS, id);
    assert.ok(receipt.xp >= XP_PLAY, id);
    assert.equal(receipt.couple, undefined, id);
    assert.equal(db.users.a.gameStats![id].played, 1);
    assert.equal(db.users.a.missions!.board, Number(BOARD_GAMES.has(id)));
    assert.equal(coupleProgress(db.users.a, db.users.b, at).xp, 0);
  }
});

test("personal wins, cross-game/current/best streaks and capped bonuses are separate", () => {
  const db = fixture([]);
  for (let i = 0; i < 9; i += 1) {
    const id = `win-${i}`;
    db.games.push(game(id, { game: i % 2 ? "chess" : "ludo" }));
    const reward = claim(db, id);
    assert.equal(reward.winHearts, WIN_HEARTS);
    assert.equal(reward.xp, XP_PLAY + XP_WIN + (reward.dare?.xp ?? 0));
    assert.equal(reward.bonus, Math.min(25, i * 5));
    assert.equal(reward.hearts, COMPLETION_HEARTS + WIN_HEARTS + reward.bonus + reward.levelReward + (reward.dare?.hearts ?? 0));
  }
  assert.equal(db.users.a.winStreak, 9);
  assert.equal(db.users.a.bestWinStreak, 9);
  assert.equal(db.users.a.gameStats!.ludo.winStreak, 5);
  assert.equal(db.users.a.gameStats!.chess.winStreak, 4);
  db.games.push(game("lost", { game: "chess", winner: "b" }));
  claim(db, "lost");
  assert.equal(db.users.a.winStreak, 0);
  assert.equal(db.users.a.bestWinStreak, 9);
  assert.equal(db.users.a.gameStats!.chess.winStreak, 0);
  assert.equal(db.users.a.gameStats!.chess.bestWinStreak, 4);
  assert.equal(db.users.a.gameStats!.ludo.winStreak, 5);
  assert.equal(db.users.a.wins, 9);
  assert.equal(streakBonus(10000), 25);
  assert.equal(LEVEL_REWARD(10000), 100);
});

test("solo completions preserve existing win streaks without manufacturing wins", () => {
  for (const patch of [
    { game: "bounce", players: ["a", "b"], state: { players: ["a", "b"] } },
    { game: "ludo", players: ["a"], state: { players: ["a"] } },
  ]) {
    const db = fixture([game("solo", patch)]);
    db.users.a.winStreak = 3;
    const receipt = claim(db, "solo");
    assert.equal(receipt.outcome, "completed");
    assert.equal(receipt.couple, undefined);
    assert.equal(receipt.winHearts, 0);
    assert.equal(receipt.bonus, 0);
    assert.equal(db.users.a.winStreak, 3);
    assert.equal(db.users.a.wins, 0);
  }
});

test("couple eligibility requires reciprocal human partners in both session/game rosters", () => {
  const cases = [
    (db: ReturnType<typeof fixture>) => { db.users.b.partnerId = undefined; },
    (db: ReturnType<typeof fixture>) => { db.users.a.partnerId = "a"; },
    (db: ReturnType<typeof fixture>) => { db.users.b.isBot = true; },
    (db: ReturnType<typeof fixture>) => { db.games[0].players = ["a", "c"]; },
    (db: ReturnType<typeof fixture>) => { db.games[0].state = { players: ["a", "c"] }; },
    (db: ReturnType<typeof fixture>) => { delete db.users.b; },
  ];
  for (const change of cases) {
    const db = fixture();
    change(db);
    assert.equal(claim(db, "one").couple, undefined);
    assert.equal(coupleProgress(db.users.a, db.users.b, at).played, 0);
  }
  for (const id of ["ai:1", "bot-priya"]) {
    const db = fixture([game("bot", { players: ["a", id], state: { players: ["a", id] } })]);
    db.users.a.partnerId = id;
    db.users[id] = user(id, { partnerId: "a" });
    assert.equal(claim(db, "bot").couple, undefined);
    assert.throws(() => claim(db, "bot", id), /human/);
  }
});

test("two human partners at a filled table qualify; bots never count as a partner or head-to-head", () => {
  const players = ["a", "b", "ai:1", "ai:2"];
  const db = fixture([game("table", { game: "callbreak", players, state: { players } })]);
  claim(db, "table");
  const progress = coupleProgress(db.users.a, db.users.b, at);
  assert.equal(progress.played, 1);
  assert.equal(progress.xp, COUPLE_XP_PLAY);
  assert.equal(progress.games.callbreak.wins.a, 1);
  assert.equal(progress.headToHead.played, 0);
});

test("union of receipts deduplicates both profiles and derives favorite/head-to-head from either side", () => {
  const db = fixture([
    game("l1", { winner: "a" }), game("l2", { winner: "b" }),
    game("l3", { winner: "draw" }), game("c1", { game: "chess", winner: "b" }),
  ]);
  claim(db, "l1");
  claim(db, "l1", "b");
  claim(db, "l2", "b");
  claim(db, "l3");
  claim(db, "c1", "b");
  const before = JSON.stringify(db.users);
  const progress = coupleProgress(db.users.a, db.users.b, at);
  assert.equal(progress.played, 4);
  assert.equal(progress.xp, COUPLE_XP_PLAY * 4);
  assert.equal(progress.favoriteGame, "ludo");
  assert.deepEqual(progress.headToHead, { played: 4, wins: { a: 1, b: 2 }, draws: 1 });
  assert.deepEqual(progress.games.ludo.headToHead, { played: 3, wins: { a: 1, b: 1 }, draws: 1 });
  assert.deepEqual(coupleReceipts(db.users.a, db.users.b), coupleReceipts(db.users.b, db.users.a));
  assert.equal(JSON.stringify(db.users), before);
  assert.equal(progress.streak, 1);
  assert.equal(progress.bestStreak, 1);
  db.users.b.partnerId = "c";
  assert.equal(coupleProgress(db.users.a, db.users.b, at).played, 0);
});

test("couple streaks use sorted unique UTC completion days, not receipt arrival or local dates", () => {
  const times = ["2026-11-11T23:59:59Z", "2026-11-12T00:00:01Z", "2026-11-12T04:00:00Z", "2026-11-14T00:00:00Z"];
  const db = fixture(times.map((time, i) => game(String(i), { finishedAt: Date.parse(time) })));
  for (const id of ["3", "1", "0", "2"]) claim(db, id, "a", at + 3 * day);
  const progress = coupleProgress(db.users.a, db.users.b, Date.parse("2026-11-14T00:30:00Z"));
  assert.equal(progress.streak, 1);
  assert.equal(progress.bestStreak, 2);
  assert.equal(progress.lastPlayedDay, "2026-11-14");
  assert.equal(coupleProgress(db.users.a, db.users.b, Date.parse("2026-11-15T23:59:59Z")).streak, 1);
  assert.equal(coupleProgress(db.users.a, db.users.b, Date.parse("2026-11-16T00:00:00Z")).streak, 0);
  assert.deepEqual(dateStreak(["2026-11-12", "2026-11-11", "2026-11-12"], at), { current: 2, best: 2, lastDay: "2026-11-12" });
});

test("daily dare is date-stable, input-order independent and visits ALL game ids", () => {
  const ids = new Set<string>();
  for (let i = 0; i < REGISTERED_GAME_IDS.length; i += 1) {
    const time = at + i * day;
    const dare = dailyDare(time);
    ids.add(dare.gameId);
    assert.deepEqual(dare, dailyDare(time, [...REGISTERED_GAME_IDS].reverse()));
    assert.equal(dare.gameId, dailyDare(Date.parse(`${dayKey(time)}T00:00:00Z`)).gameId);
    assert.equal(dare.gameId, dailyDare(Date.parse(`${dayKey(time)}T23:59:59Z`)).gameId);
    assert.equal(dare.title, "Complete today's featured game");
  }
  assert.deepEqual([...ids].sort(), [...REGISTERED_GAME_IDS].sort());
  assert.throws(() => dailyDare(at, []));
});

test("dare bonus pays automatically once per date, on loss/draw/solo, with capped daily streak", () => {
  const db = fixture([]);
  for (let i = 0; i < 9; i += 1) {
    const now = at + i * day;
    const featured = dailyDare(now).gameId;
    const session = game(`day-${i}`, { game: featured, winner: i % 2 ? "draw" : "b", finishedAt: now });
    db.games.push(session, { ...session, id: `repeat-${i}` });
    const first = claim(db, session.id, "a", now);
    assert.equal(first.dare?.day, dayKey(now));
    assert.equal(first.dare?.streak, i + 1);
    assert.equal(first.dare?.xp, DARE_XP);
    assert.equal(first.dare?.hearts, DARE_HEARTS + Math.min(25, i * 5));
    assert.equal(claim(db, `repeat-${i}`, "a", now).dare, undefined);
    assert.equal(dailyDareState(db.users.a, now).completed, true);
  }
  const gap = at + 11 * day;
  db.games.push(game("gap", { game: dailyDare(gap).gameId, finishedAt: gap }));
  assert.equal(claim(db, "gap", "a", gap).dare?.streak, 1);
  assert.equal(dailyDareState(db.users.a, gap).bestStreak, 9);
});

test("old completions cannot claim today's dare or advance today's missions", () => {
  const db = fixture([game("old", { game: dailyDare(at).gameId, finishedAt: at - day })]);
  const receipt = claim(db, "old");
  assert.equal(receipt.day, dayKey(at - day));
  assert.equal(receipt.dare, undefined);
  assert.equal(db.users.a.missions!.played, 0);
  assert.equal(db.users.a.gameStats![receipt.game].played, 1);
});

test("no-op/stale callbacks keep revision, timestamp and logs unchanged", () => {
  const before = freeze(game("playing", { status: "playing", finishedAt: undefined }));
  const noop = { ...before, state: structuredClone(before.state), rev: 99, updatedAt: 999 };
  assert.equal(finalizeGameUpdate(before, noop, at + 10), before);
  const statusOnly = finalizeGameUpdate(before, { ...before, status: "finished" }, at + 10);
  assert.equal(statusOnly.highlights!.length, 0);
  assert.equal(statusOnly.finishedAt, at + 10);
  assert.equal(statusOnly.rev, before.rev + 1);
  assert.equal(finalizeGameUpdate(statusOnly, { ...statusOnly, state: { log: "late" } }, at + day), statusOnly);
});

test("actual state changes persist last three bounded raw-ID logs; receipts retain a detached snapshot", () => {
  let session = game("logs", { status: "playing", rev: 0, finishedAt: undefined, state: { n: 0 } });
  for (let n = 1; n <= 6; n += 1) {
    const log = n === 6 ? `a|won against @[b] ${"x".repeat(1000)}` : "a|rolled 6";
    session = finalizeGameUpdate(session, { ...session, state: { n, log } }, at + n);
  }
  assert.equal(session.highlights!.length, MAX_GAME_HIGHLIGHTS);
  assert.deepEqual(session.highlights!.map((h) => h.rev), [4, 5, 6]);
  assert.equal(session.highlights![0].log, session.highlights![1].log); // Same roll, different genuine move.
  assert.equal(session.highlights![2].log.length, MAX_HIGHLIGHT_LENGTH);
  assert.ok(session.highlights![2].log.startsWith("a|won against @[b]"));
  session = finalizeGameUpdate(session, { ...session, status: "finished" }, at + 7);
  const db = fixture([session]);
  const receipt = claim(db, "logs", "a", at + 8);
  assert.deepEqual(receipt.highlights, session.highlights);
  session.highlights![0].log = "changed externally";
  assert.notEqual(receipt.highlights[0].log, session.highlights![0].log);
});

test("recent couple history is bounded but the permanent dedupe ledger is not evicted", () => {
  const db = fixture([]);
  for (let i = 0; i < MAX_COUPLE_RECENT + 5; i += 1) {
    db.games.push(game(`session-${i}`, { finishedAt: at + i }));
    claim(db, `session-${i}`, "a", at + i);
  }
  const progress = coupleProgress(db.users.a, db.users.b, at + day);
  assert.equal(progress.recent.length, MAX_COUPLE_RECENT);
  assert.equal(progress.played, MAX_COUPLE_RECENT + 5);
  const hearts = db.users.a.hearts;
  claim(db, "session-0", "a", at + day);
  assert.equal(db.users.a.hearts, hearts);
  assert.equal(coupleRank(0).level, 1);
  assert.equal(coupleRank(200).level, 2);
  assert.equal(coupleRank(100000).next, null);
});
