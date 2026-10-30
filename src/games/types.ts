import type { ComponentType } from "react";

export interface GameViewProps<S, A> {
  state: S;
  me: string;
  players: string[];
  names: Record<string, string>;
  act: (action: A) => void;
  finished: boolean;
}

// A multiplayer game is a pure reducer: every client applies the same
// actions, so the shared state can live in any backend.
export interface GameDef<S = any, A = any> {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  className: string;
  minPlayers: number;
  maxPlayers: number;
  soloOnly?: boolean;
  // Seats always filled to this many players; empty ones get bots.
  fillTo?: number;
  // Card games: the table uses the viewer's card skin felt.
  felt?: boolean;
  init: (players: string[]) => S;
  apply: (state: S, action: A, by: string) => S;
  winner: (state: S) => string | null;
  currentPlayer?: (state: S) => string | null;
  botMove?: (state: S, bot: string) => A | null;
  botDelay?: number;
  View: ComponentType<GameViewProps<S, A>>;
}

export const isBotPlayer = (id: string) => id.startsWith("ai:");

export function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
