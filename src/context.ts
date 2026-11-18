import { createContext, useContext } from "react";
import type { DB, User } from "./backend/types";

export interface AppCtx {
  db: DB;
  me: User;
  notify: (message: string) => void;
  openChat: (convId: string) => void;
  openGame: (sessionId: string) => void;
  playGame: (gameId: string, opponents: string[], convId?: string, wager?: number) => void;
  nameOf: (id: string) => string;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside AppContext");
  return ctx;
}

// Runs an action and turns thrown errors into a toast.
export function attempt(notify: (message: string) => void, fn: () => void) {
  try {
    fn();
    return true;
  } catch (error) {
    notify(error instanceof Error ? error.message : "Something went wrong");
    return false;
  }
}
