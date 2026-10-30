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

export const LEVEL_REWARD = (level: number) => 25 + level * 5;
export const XP_PLAY = 10;
export const XP_WIN = 30;
export const WIN_HEARTS = 20;
// Extra hearts for a win streak: +5 per win in a row, capped.
export const streakBonus = (streak: number) => Math.min(25, Math.max(0, streak - 1) * 5);

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
export const BOARD_GAMES = new Set(["ludo", "snakes", "chess", "checkers", "tycoon"]);

export const MISSIONS: Mission[] = [
  { id: "play3", title: "Play 3 games", goal: 3, reward: 15, count: (m) => m.played },
  { id: "win1", title: "Win a game", goal: 1, reward: 20, count: (m) => m.won },
  { id: "cards", title: "Play a card game", goal: 1, reward: 15, count: (m) => m.cards },
  { id: "board", title: "Play a board game", goal: 1, reward: 15, count: (m) => m.board },
];

export function missionState(user: User): MissionState {
  const m = user.missions;
  return m && m.day === dayKey() ? m : { day: dayKey(), played: 0, won: 0, cards: 0, board: 0, claimed: [] };
}
