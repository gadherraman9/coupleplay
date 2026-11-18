// Engagement loop: daily login calendar, XP levels, win streaks and daily
// missions. Pure helpers here; the writes live in store.ts (api.*).
import type { User } from "./backend/types";

// 7-day login calendar; day 7 is the big one, then it starts again.
export const DAILY_REWARDS = [10, 15, 20, 30, 40, 60, 120];

export function dayKey(at = Date.now()) {
  return new Date(at).toISOString().slice(0, 10);
}

export function canClaimDaily(user: User) {
  return user.rewardDay !== dayKey();
}

// Which calendar day the next claim lands on (0-based).
export function nextRewardIndex(user: User) {
  const yesterday = dayKey(Date.now() - 86_400_000);
  const streak = user.rewardDay === yesterday || user.rewardDay === dayKey() ? user.rewardStreak ?? 0 : 0;
  return user.rewardDay === dayKey() ? (streak - 1 + 7) % 7 : streak % 7;
}

// Level n needs 50 * (n-1)^2 XP: quick early levels, slower later.
export const levelOf = (xp = 0) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const xpForLevel = (level: number) => 50 * (level - 1) ** 2;

export function levelProgress(xp = 0) {
  const level = levelOf(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, into: xp - from, need: to - from, pct: Math.round(((xp - from) / (to - from)) * 100) };
}

export const LEVEL_REWARD = (level: number) => Math.min(100, 25 + level * 5);
export const XP_PLAY = 20;
export const XP_WIN = 30;
export const COMPLETION_HEARTS = 30;
export const WIN_HEARTS = 20;
// Extra hearts for a win streak: +5 per win in a row, capped.
export const streakBonus = (streak: number) => Math.min(25, Math.max(0, streak - 1) * 5);

// Data-only mirror of games/registry.ts: no React/game/store import cycle.
// progression.test.ts checks parity against the actual registry source.
export const REGISTERED_GAME_IDS = [
  "ludo", "poker", "callbreak", "rummy", "cards", "chess", "pool",
  "fourinrow", "snakes", "checkers", "tycoon", "dots", "tictactoe", "bounce",
] as const;
export const SOLO_GAME_IDS = new Set<string>(["bounce"]);
export const isRegisteredGame = (id: string) => (REGISTERED_GAME_IDS as readonly string[]).includes(id);

export const DARE_HEARTS = 50;
export const DARE_XP = 25;
export const dareStreakBonus = streakBonus;

export interface DailyDare {
  day: string;
  gameId: string;
  title: string;
  hearts: number;
  xp: number;
}

// Rotates over every registered id, independent of locale, list order or RNG.
export function dailyDare(at = Date.now(), gameIds: readonly string[] = REGISTERED_GAME_IDS): DailyDare {
  const ids = [...new Set(gameIds)].sort();
  if (!ids.length) throw new Error("A daily dare needs at least one game");
  const day = dayKey(at);
  const ordinal = Math.floor(Date.parse(day) / 86_400_000);
  return {
    day, gameId: ids[((ordinal % ids.length) + ids.length) % ids.length],
    title: "Complete today's featured game", hearts: DARE_HEARTS, xp: DARE_XP,
  };
}

// Consecutive distinct UTC play dates; today's absence keeps yesterday alive.
export function dateStreak(days: readonly string[], at = Date.now()) {
  const today = dayKey(at);
  const dates = [...new Set(days)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today).sort();
  let run = 0;
  let best = 0;
  let previous: string | undefined;
  for (const day of dates) {
    run = previous && Date.parse(day) - Date.parse(previous) === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  const lastDay = dates[dates.length - 1];
  const current = lastDay === today || lastDay === dayKey(at - 86_400_000) ? run : 0;
  return { current, best, lastDay };
}

export function dailyDareState(user: User, at = Date.now()) {
  const dare = dailyDare(at);
  const days = Object.values(user.gameReceipts ?? {}).flatMap((r) => r.dare ? [r.dare.day] : []);
  const streak = dateStreak(days, at);
  return { ...dare, completed: days.includes(dare.day), streak: streak.current, bestStreak: streak.best };
}

export interface Mission {
  id: string;
  title: string;
  goal: number;
  reward: number;
  count: (m: MissionState) => number;
}

export interface MissionState {
  day: string;
  played: number;
  won: number;
  cards: number;
  board: number;
  claimed: string[];
}

export const CARD_GAMES = new Set(["poker", "callbreak", "rummy", "cards"]);
export const BOARD_GAMES = new Set(["ludo", "snakes", "chess", "checkers", "tycoon", "fourinrow", "dots", "tictactoe"]);

export const MISSIONS: Mission[] = [
  { id: "play3", title: "Play 3 games", goal: 3, reward: 15, count: (m) => m.played },
  { id: "win1", title: "Win a game", goal: 1, reward: 20, count: (m) => m.won },
  { id: "cards", title: "Play a card game", goal: 1, reward: 15, count: (m) => m.cards },
  { id: "board", title: "Play a board game", goal: 1, reward: 15, count: (m) => m.board },
];

export function missionState(user: User, at = Date.now()): MissionState {
  const m = user.missions;
  const day = dayKey(at);
  return m && m.day === day ? m : { day, played: 0, won: 0, cards: 0, board: 0, claimed: [] };
}
