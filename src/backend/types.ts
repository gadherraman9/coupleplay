export interface User {
  id: string;
  username: string;
  displayName: string;
  hue: number;
  isGuest: boolean;
  isBot?: boolean;
  passwordHash?: string;
  hearts: number;
  streak: number;
  lastDailyTask?: string;
  ownedThemes: string[];
  appTheme: string;
  chatTheme: string;
  partnerId?: string;
  // Picked game skins by kind (ludo, snakes, dice, token, cards, table).
  skins?: Partial<Record<"ludo" | "snakes" | "dice" | "token" | "cards" | "table", string>>;
  // Progression: XP from playing, total wins and the current win streak.
  xp?: number;
  wins?: number;
  winStreak?: number;
  bestWinStreak?: number;
  draws?: number;
  // Daily login reward: last day claimed and how many days in a row.
  rewardDay?: string;
  rewardStreak?: number;
  // Today's mission progress (see progress.ts).
  gameStats?: Record<string, GameStats>;
  missions?: { day: string; played: number; won: number; cards: number; board: number; claimed: string[] };
  // Permanent, compact deduplication ledger. Never prune paid session ids:
  // doing so would let an old session pay again. No game state is copied.
  gameReceipts?: Record<string, GameRewardReceipt>;
  suspended?: boolean;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  createdAt: number;
}

export interface Friendship {
  id: string;
  a: string;
  b: string;
  createdAt: number;
}

export interface Block {
  by: string;
  target: string;
  reason: string;
  createdAt: number;
}

export interface Report {
  id: string;
  by: string;
  target: string;
  reason: string;
  details?: string;
  createdAt: number;
}

export type MessageKind = "text" | "image" | "voice" | "invite" | "system";

export interface ChatMessage {
  id: string;
  convId: string;
  from: string;
  kind: MessageKind;
  text?: string;
  media?: string;
  duration?: number;
  invite?: { game: string; sessionId?: string; title: string };
  createdAt: number;
}

export interface Room {
  id: string;
  name: string;
  emoji: string;
  topic: string;
}

export interface GameStats {
  played: number;
  won: number;
  draws?: number;
  winStreak?: number;
  bestWinStreak?: number;
  bestScore?: number;
}

export interface GameHighlight {
  rev: number;
  at: number;
  // Unresolved `playerId|text` / `@[playerId]` tokens, for the viewer's UI.
  log: string;
}

export type GameOutcome = "win" | "loss" | "draw" | "completed";

export interface DareReward {
  day: string;
  streak: number;
  hearts: number;
  xp: number;
  bonus: number;
}

export interface GameRewardReceipt {
  sessionId: string;
  userId: string;
  game: string;
  players: string[];
  winner: string | null; // "draw" is the only draw sentinel.
  outcome: GameOutcome;
  completedAt: number;
  recordedAt: number;
  day: string; // UTC completion date, not claim date.
  hearts: number; // Total, including all bonuses below.
  xp: number; // Total, including dare XP.
  completionHearts: number;
  winHearts: number;
  bonus: number; // Capped win-streak hearts.
  streak: number;
  levelUp: number; // New level, or 0.
  levelReward: number;
  dare?: DareReward;
  // Eligibility snapshot: reciprocal humans present in this session's roster.
  // One partner's receipt is enough; never write the other profile.
  couple?: { players: [string, string]; xp: number };
  highlights: GameHighlight[];
}

export type GameStatus = "waiting" | "playing" | "finished";

export interface GameSession {
  id: string;
  game: string;
  players: string[];
  host: string;
  status: GameStatus;
  state: unknown;
  winner?: string | null;
  convId: string;
  rev: number;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  highlights?: GameHighlight[];
  playedBy?: string[];
}

export interface QueueEntry {
  userId: string;
  kind: "chat" | "game";
  game?: string;
  since: number;
}

export interface StrangerChat {
  id: string;
  a: string;
  b: string;
  open: boolean;
  createdAt: number;
}

export interface DB {
  version: number;
  users: Record<string, User>;
  requests: FriendRequest[];
  friendships: Friendship[];
  blocks: Block[];
  reports: Report[];
  messages: ChatMessage[];
  rooms: Room[];
  games: GameSession[];
  queue: QueueEntry[];
  strangers: StrangerChat[];
  presence: Record<string, number>;
  reads: Record<string, number>;
}
