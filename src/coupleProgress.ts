// Pure progression reducers/selectors. No React, browser, registry or store imports.
import type { DB, GameHighlight, GameRewardReceipt, GameSession, User } from "./backend/types";
import {
  BOARD_GAMES, CARD_GAMES, COMPLETION_HEARTS, dailyDareState, dareStreakBonus,
  dateStreak, dayKey, isRegisteredGame, LEVEL_REWARD, levelOf, missionState,
  SOLO_GAME_IDS, streakBonus, WIN_HEARTS, XP_PLAY, XP_WIN,
} from "./progress";

export const MAX_GAME_HIGHLIGHTS = 3;
export const MAX_HIGHLIGHT_LENGTH = 280;
export const MAX_COUPLE_RECENT = 10;
export const COUPLE_XP_PLAY = 40;

export function highlightText(log: string, names: Record<string, string>) {
  const split = log.indexOf("|");
  const text = split < 0 ? log : `${names[log.slice(0, split)] ?? "Player"} ${log.slice(split + 1)}`;
  return text.replace(/@\[([^\]]+)\]/g, (_, id: string) => names[id] ?? "Player");
}

function stateObject(state: unknown): Record<string, unknown> {
  return state !== null && typeof state === "object" ? state as Record<string, unknown> : {};
}

function boundedHighlights(highlights: readonly GameHighlight[] = []): GameHighlight[] {
  return highlights.slice(-MAX_GAME_HIGHLIGHTS).map((h) => ({ ...h, log: h.log.slice(0, MAX_HIGHLIGHT_LENGTH) }));
}

// Invalid moves/stale bot callbacks must not advance rev/time or duplicate logs.
// Finished sessions are immutable; their date/result must survive late callbacks.
export function finalizeGameUpdate(before: GameSession, patched: GameSession, at = Date.now()): GameSession {
  if (before.status === "finished") return before;
  const content = (s: GameSession) => {
    const { rev: _rev, updatedAt: _updatedAt, highlights: _highlights, finishedAt: _finishedAt, ...rest } = s;
    return JSON.stringify(rest);
  };
  if (content(before) === content(patched)) return before;
  const rev = before.rev + 1;
  const highlights = boundedHighlights(before.highlights);
  if (JSON.stringify(before.state) !== JSON.stringify(patched.state)) {
    const log = stateObject(patched.state).log;
    if (typeof log === "string" && log.trim()) {
      highlights.push({ rev, at, log: log.slice(0, MAX_HIGHLIGHT_LENGTH) });
    }
  }
  return {
    ...patched, rev, updatedAt: at,
    finishedAt: patched.status === "finished" ? at : before.finishedAt,
    highlights: boundedHighlights(highlights),
  };
}

function human(user: User | undefined): user is User {
  return Boolean(user && !user.isBot && !user.id.startsWith("ai:") && !user.id.startsWith("bot-"));
}

function reciprocal(a: User, b: User | undefined): b is User {
  return human(a) && human(b) && a.id !== b.id && a.partnerId === b.id && b.partnerId === a.id;
}

// Roster membership is the session's participation evidence (not a partner link
// or chat invite). If a game supplies its own roster, it must agree as well.
function participated(session: GameSession, id: string) {
  const roster = stateObject(session.state).players;
  return session.players.includes(id) && (!Array.isArray(roster) || roster.includes(id));
}

export interface RecordGameResult {
  user: User;
  receipt: GameRewardReceipt;
}

// A new reward validates the persisted session, never a caller's win/solo flag.
// Repeat claims return the original receipt even after local game cleanup.
// The caller persists ONLY result.user; no shared wallet/profile mutation.
export function recordGameProgress(
  db: Pick<DB, "users" | "games">, me: string, sessionId: string, at = Date.now(),
): RecordGameResult {
  const user = db.users[me];
  if (!human(user)) throw new Error("Only a human player can claim a game reward");
  const existing = Object.prototype.hasOwnProperty.call(user.gameReceipts ?? {}, sessionId)
    ? user.gameReceipts![sessionId] : undefined;
  if (existing) return { user, receipt: existing };
  const session = db.games.find((g) => g.id === sessionId);
  if (!session) throw new Error("Game not found");
  if (session.status !== "finished") throw new Error("Finish the game before claiming a reward");
  if (!isRegisteredGame(session.game)) throw new Error("Unknown game");
  if (!participated(session, me)) throw new Error("You did not participate in this game");
  const winner = session.winner ?? null;
  if (winner !== null && winner !== "draw" && !session.players.includes(winner)) {
    throw new Error("Invalid game winner");
  }
  const completedAt = session.finishedAt ?? session.updatedAt;
  if (!Number.isFinite(completedAt)) throw new Error("Invalid completion date");
  const day = dayKey(completedAt);
  const solo = SOLO_GAME_IDS.has(session.game) || new Set(session.players).size < 2;
  const outcome = solo ? "completed" : winner === "draw" ? "draw" : winner === me ? "win" : winner ? "loss" : "completed";
  const won = outcome === "win";
  const drew = outcome === "draw";
  // Solo/no-result completions neither manufacture nor break a win streak.
  const streak = won ? (user.winStreak ?? 0) + 1 : outcome === "completed" ? user.winStreak ?? 0 : 0;
  const stats = user.gameStats?.[session.game] ?? { played: 0, won: 0 };
  const gameStreak = won ? (stats.winStreak ?? 0) + 1 : outcome === "completed" ? stats.winStreak ?? 0 : 0;
  const bonus = won ? streakBonus(streak) : 0;
  const dareState = dailyDareState(user, at);
  // Old sessions still earn completion rewards, but cannot satisfy today's dare.
  const dare = day === dareState.day && session.game === dareState.gameId && !dareState.completed
    ? {
      day, streak: dareState.streak + 1, xp: dareState.xp,
      bonus: dareStreakBonus(dareState.streak + 1),
      hearts: dareState.hearts + dareStreakBonus(dareState.streak + 1),
    } : undefined;
  const xp = XP_PLAY + (won ? XP_WIN : 0) + (dare?.xp ?? 0);
  const beforeLevel = levelOf(user.xp);
  const totalXP = (user.xp ?? 0) + xp;
  const afterLevel = levelOf(totalXP);
  const levelReward = afterLevel > beforeLevel ? LEVEL_REWARD(afterLevel) : 0;
  const hearts = COMPLETION_HEARTS + (won ? WIN_HEARTS : 0) + bonus + levelReward + (dare?.hearts ?? 0);
  const partner = user.partnerId ? db.users[user.partnerId] : undefined;
  const couple = !solo && reciprocal(user, partner) && participated(session, partner.id)
    && session.playedBy?.includes(me) && session.playedBy.includes(partner.id)
    ? { players: [me, partner.id].sort() as [string, string], xp: COUPLE_XP_PLAY } : undefined;
  const receipt: GameRewardReceipt = {
    sessionId, userId: me, game: session.game, players: [...session.players],
    winner, outcome, completedAt, recordedAt: at, day, hearts, xp,
    completionHearts: COMPLETION_HEARTS, winHearts: won ? WIN_HEARTS : 0,
    bonus, streak, levelUp: afterLevel > beforeLevel ? afterLevel : 0, levelReward,
    dare, couple, highlights: boundedHighlights(session.highlights),
  };
  const missions = { ...missionState(user, at) };
  if (day === missions.day) {
    missions.played += 1;
    if (won) missions.won += 1;
    if (CARD_GAMES.has(session.game)) missions.cards += 1;
    if (BOARD_GAMES.has(session.game)) missions.board += 1;
  }
  return {
    receipt,
    user: {
      ...user, hearts: user.hearts + hearts, xp: totalXP,
      wins: (user.wins ?? 0) + Number(won), draws: (user.draws ?? 0) + Number(drew),
      winStreak: streak, bestWinStreak: Math.max(user.bestWinStreak ?? 0, user.winStreak ?? 0, streak),
      missions,
      gameStats: {
        ...user.gameStats,
        [session.game]: {
          ...stats, played: stats.played + 1, won: stats.won + Number(won), draws: (stats.draws ?? 0) + Number(drew),
          winStreak: gameStreak, bestWinStreak: Math.max(stats.bestWinStreak ?? 0, stats.winStreak ?? 0, gameStreak),
          ...(session.game === "bounce" ? { bestScore: Math.max(stats.bestScore ?? 0, Number(stateObject(session.state).best) || 0) } : {}),
        },
      },
      gameReceipts: { ...user.gameReceipts, [sessionId]: receipt },
    },
  };
}

export const COUPLE_RANKS = [
  { title: "New duo", xp: 0 },
  { title: "Teammates", xp: 200 },
  { title: "In sync", xp: 600 },
  { title: "Power couple", xp: 1400 },
  { title: "Unstoppable", xp: 3000 },
] as const;

export interface CoupleRank {
  level: number;
  title: string;
  from: number;
  next: number | null;
}

export function coupleRank(xp = 0): CoupleRank {
  let index = 0;
  for (let i = 1; i < COUPLE_RANKS.length; i += 1) if (xp >= COUPLE_RANKS[i].xp) index = i;
  return { level: index + 1, title: COUPLE_RANKS[index].title, from: COUPLE_RANKS[index].xp, next: COUPLE_RANKS[index + 1]?.xp ?? null };
}

// Merge either profile's evidence; don't require both to have opened the result
// screen. Resolve duplicate snapshots deterministically, independent of viewer.
export function coupleReceipts(me: User, partner?: User): GameRewardReceipt[] {
  if (!reciprocal(me, partner)) return [];
  const pair = [me.id, partner.id].sort();
  const candidates = [me, partner].flatMap((owner) => Object.entries(owner.gameReceipts ?? {})
    .filter(([id, r]) => id === r.sessionId && r.userId === owner.id)
    .map(([, r]) => r))
    .filter((r) => isRegisteredGame(r.game) && !SOLO_GAME_IDS.has(r.game)
      && r.couple?.players.length === 2 && pair.every((id) => r.couple!.players.includes(id) && r.players.includes(id)))
    .sort((a, b) => a.recordedAt - b.recordedAt || a.userId.localeCompare(b.userId));
  const sessions = new Map<string, GameRewardReceipt>();
  for (const receipt of candidates) if (!sessions.has(receipt.sessionId)) sessions.set(receipt.sessionId, receipt);
  return [...sessions.values()].sort((a, b) => a.completedAt - b.completedAt || a.sessionId.localeCompare(b.sessionId));
}

export interface HeadToHead {
  played: number;
  wins: Record<string, number>;
  draws: number;
}

export interface CoupleGameStats {
  played: number;
  wins: Record<string, number>;
  draws: number;
  lastPlayedDay: string;
  headToHead: HeadToHead; // Only two-seat sessions, not group games.
}

export interface CoupleProgress {
  eligible: boolean;
  partnerId?: string;
  played: number;
  xp: number;
  rank: CoupleRank;
  streak: number;
  bestStreak: number;
  lastPlayedDay?: string;
  favoriteGame?: string; // Ties resolved by game id, never display name.
  games: Record<string, CoupleGameStats>;
  headToHead: HeadToHead;
  recent: GameRewardReceipt[]; // Newest first, at most MAX_COUPLE_RECENT.
}

export function coupleProgress(me: User, partner?: User, at = Date.now()): CoupleProgress {
  const eligible = reciprocal(me, partner);
  const receipts = coupleReceipts(me, partner);
  const pair = eligible ? [me.id, partner.id].sort() : [me.id];
  const emptyHeadToHead = (): HeadToHead => ({ played: 0, wins: Object.fromEntries(pair.map((id) => [id, 0])), draws: 0 });
  const headToHead = emptyHeadToHead();
  const games: Record<string, CoupleGameStats> = {};
  let xp = 0;
  const addResult = (stats: HeadToHead, r: GameRewardReceipt) => {
    stats.played += 1;
    if (r.winner === "draw") stats.draws += 1;
    else if (r.winner && pair.includes(r.winner)) stats.wins[r.winner] += 1;
  };
  for (const receipt of receipts) {
    const stats = games[receipt.game] ?? {
      ...emptyHeadToHead(), lastPlayedDay: receipt.day, headToHead: emptyHeadToHead(),
    };
    addResult(stats, receipt);
    stats.lastPlayedDay = receipt.day;
    if (new Set(receipt.players).size === 2) {
      addResult(stats.headToHead, receipt);
      addResult(headToHead, receipt);
    }
    games[receipt.game] = stats;
    xp += receipt.couple!.xp;
  }
  const streak = dateStreak(receipts.map((r) => dayKey(r.completedAt)), at);
  const favoriteGame = Object.keys(games).sort((a, b) => games[b].played - games[a].played || a.localeCompare(b))[0];
  return {
    eligible, partnerId: eligible ? partner.id : undefined, played: receipts.length,
    xp, rank: coupleRank(xp), streak: streak.current, bestStreak: streak.best,
    lastPlayedDay: streak.lastDay, favoriteGame, games, headToHead,
    recent: receipts.slice(-MAX_COUPLE_RECENT).reverse(),
  };
}
