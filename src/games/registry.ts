import { bounceGame } from "./bounce";
import { cardsGame } from "./cards";
import { ludoGame } from "./ludo";
import { poolGame } from "./pool";
import { snakesGame } from "./snakes";
import { tycoonGame } from "./tycoon";
import type { GameDef } from "./types";

export const ONLINE_GAMES: GameDef[] = [ludoGame, cardsGame, poolGame, snakesGame, tycoonGame, bounceGame];

export function gameById(id: string) {
  return ONLINE_GAMES.find((game) => game.id === id);
}

export function botName(id: string) {
  return `Bot ${id.slice(3)}`;
}
