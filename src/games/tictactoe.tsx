import { useEffect } from "react";
import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const TARGET = 3;
const MARK_COLORS = ["#ec4899", "#8b5cf6"];

interface State {
  players: string[];
  board: (number | null)[];
  turn: number;
  starter: number;
  scores: number[];
  // Set while the finished round is still on screen.
  roundOver: { line: number[] | null } | null;
  round: number;
  log: string;
  winner: string | null;
}

type Action = { type: "mark"; cell: number } | { type: "next"; round: number };

function lineOf(board: (number | null)[]) {
  return LINES.find(([a, b, c]) => board[a] !== null && board[a] === board[b] && board[a] === board[c]) ?? null;
}

function minimax(board: (number | null)[], seat: number, me: number): number {
  const line = lineOf(board);
  if (line) return board[line[0]] === me ? 10 : -10;
  if (board.every((c) => c !== null)) return 0;
  const scores = board.flatMap((c, i) => {
    if (c !== null) return [];
    const next = [...board];
    next[i] = seat;
    return [minimax(next, 1 - seat, me) * 0.9];
  });
  return seat === me ? Math.max(...scores) : Math.min(...scores);
}

function Mark({ seat }: { seat: number }) {
  return seat === 0 ? (
    <svg viewBox="0 0 40 40" className="ttt-mark">
      <path d="M10 10 L30 30" stroke={MARK_COLORS[0]} />
      <path d="M30 10 L10 30" stroke={MARK_COLORS[0]} />
    </svg>
  ) : (
    <svg viewBox="0 0 40 40" className="ttt-mark">
      <circle cx="20" cy="20" r="11" stroke={MARK_COLORS[1]} />
    </svg>
  );
}

function TicTacToeView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const current = state.players[state.turn];
  const myTurn = current === me && !finished && !state.roundOver;
  const marks = state.board.filter((c) => c !== null).length;
  useOnChange(marks, (prev, next) => next > prev && play("place"));
  useOnChange(state.round, () => play("tap"));

  useEffect(() => {
    if (!state.roundOver || finished) return;
    const round = state.round;
    const timer = window.setTimeout(() => act({ type: "next", round }), 1700);
    return () => window.clearTimeout(timer);
  }, [state.roundOver, state.round, finished, act]);

  const line = state.roundOver?.line;
  return (
    <div className="board-game ttt-game">
      <div className="score-row">
        {state.players.map((player, seat) => (
          <span key={player} className={`score-pill ${player === current && !state.roundOver ? "is-turn" : ""}`} style={{ ["--accent" as string]: MARK_COLORS[seat] }}>
            <Mark seat={seat} />
            <b>{names[player]}</b>
            <strong>{state.scores[seat]}</strong>
          </span>
        ))}
      </div>
      <p className="score-goal">First to {TARGET} rounds wins</p>
      <div className="ttt-board">
        {state.board.map((cell, i) => (
          <button
            key={`${state.round}-${i}`}
            type="button"
            className={`ttt-cell ${line?.includes(i) ? "is-line" : ""} ${myTurn && cell === null ? "is-open" : ""}`}
            disabled={!myTurn || cell !== null}
            onClick={() => act({ type: "mark", cell: i })}
            aria-label={`Square ${i + 1}`}
          >
            {cell !== null && <Mark seat={cell} />}
          </button>
        ))}
      </div>
      <LogLine log={state.log} names={names} />
      <p className="turn-label">
        {finished ? "Game over" : state.roundOver ? "Next round…" : myTurn ? "Your move" : `${names[current]} is thinking…`}
      </p>
    </div>
  );
}

export const ticTacToeGame: GameDef<State, Action> = {
  id: "tictactoe",
  title: "Tic-Tac-Toe",
  tagline: "Three in a row. First to 3 rounds wins.",
  emoji: "❌",
  className: "game-card--ttt",
  minPlayers: 2,
  maxPlayers: 2,
  botDelay: 800,
  init: (players) => ({
    players,
    board: Array(9).fill(null),
    turn: 0,
    starter: 0,
    scores: [0, 0],
    roundOver: null,
    round: 1,
    log: "Round 1 — tap a square.",
    winner: null,
  }),
  apply: (state, action, by) => {
    const seat = state.players.indexOf(by);
    if (state.winner || seat < 0) return state;
    if (action.type === "next") {
      if (!state.roundOver || action.round !== state.round) return state;
      const starter = 1 - state.starter;
      return { ...state, board: Array(9).fill(null), roundOver: null, starter, turn: starter, round: state.round + 1, log: `Round ${state.round + 1}!` };
    }
    if (state.roundOver || seat !== state.turn || action.type !== "mark" || state.board[action.cell] !== null) return state;
    const board = [...state.board];
    board[action.cell] = seat;
    const line = lineOf(board);
    if (line) {
      const scores = [...state.scores];
      scores[seat] += 1;
      const won = scores[seat] >= TARGET;
      return { ...state, board, scores, roundOver: { line }, winner: won ? by : null, log: `${by}|${won ? "won the match! 🏆" : "won the round!"}` };
    }
    if (board.every((c) => c !== null)) return { ...state, board, roundOver: { line: null }, log: "It's a draw — replaying the round" };
    return { ...state, board, turn: 1 - seat, log: `${by}|played` };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => (state.roundOver ? null : state.players[state.turn]),
  botMove: (state, bot) => {
    const seat = state.players.indexOf(bot);
    const open = state.board.flatMap((c, i) => (c === null ? [i] : []));
    if (open.length === 0) return null;
    // A friendly bot: plays perfectly most of the time.
    if (Math.random() < 0.22) return { type: "mark", cell: open[Math.floor(Math.random() * open.length)] };
    let best = open[0];
    let bestScore = -Infinity;
    for (const i of open) {
      const next = [...state.board];
      next[i] = seat;
      const score = minimax(next, 1 - seat, seat) + Math.random() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return { type: "mark", cell: best };
  },
  View: TicTacToeView,
};
