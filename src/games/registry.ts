import { bounceGame } from "./bounce";
import { cardsGame } from "./cards";
import { checkersGame } from "./checkers";
import { dotsGame } from "./dots";
import { fourInRowGame } from "./fourinrow";
import { ludoGame } from "./ludo";
import { poolGame } from "./pool";
import { snakesGame } from "./snakes";
import { ticTacToeGame } from "./tictactoe";
import { tycoonGame } from "./tycoon";
import type { GameDef } from "./types";

export const ONLINE_GAMES: GameDef[] = [
  ludoGame,
  cardsGame,
  poolGame,
  fourInRowGame,
  snakesGame,
  checkersGame,
  tycoonGame,
  dotsGame,
  ticTacToeGame,
  bounceGame,
];

export function gameById(id: string) {
  return ONLINE_GAMES.find((game) => game.id === id);
}

export function botName(id: string) {
  return `Bot ${id.slice(3)}`;
}
