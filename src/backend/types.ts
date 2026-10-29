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
