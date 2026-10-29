import { useEffect, useState } from "react";
import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";

const COLS = 7;
const ROWS = 6;
const DISC_COLORS = ["#ec4899", "#facc15"];

interface State {
  players: string[];
  // board[row * COLS + col], row 0 is the top.
  board: (number | null)[];
  turn: number;
  lastDrop: number | null;
  line: number[] | null;
  drawn: boolean;
  round: number;
  log: string;
  winner: string | null;
}

type Action = { type: "drop"; col: number } | { type: "next"; round: number };

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function landingRow(board: (number | null)[], col: number) {
  for (let r = ROWS - 1; r >= 0; r -= 1) if (board[r * COLS + col] === null) return r;
  return -1;
}

function winLine(board: (number | null)[], at: number) {
  const seat = board[at];
  if (seat === null) return null;
  const r0 = Math.floor(at / COLS);
  const c0 = at % COLS;
  for (const [dr, dc] of DIRS) {
    const cells = [at];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === seat) {
        cells.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

// Heuristic: count open windows of four for each side.
function evaluate(board: (number | null)[], seat: number) {
  let score = 0;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3;
        const ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k += 1) {
          const v = board[(r + dr * k) * COLS + c + dc * k];
          if (v === seat) mine += 1;
          else if (v !== null) theirs += 1;
        }
        if (theirs === 0) score += [0, 1, 4, 20][mine] ?? 0;
        if (mine === 0) score -= [0, 1, 5, 40][theirs] ?? 0;
      }
    }
  }
  for (let r = 0; r < ROWS; r += 1) if (board[r * COLS + 3] === seat) score += 3;
  return score;
}

function negamax(board: (number | null)[], seat: number, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(board, seat);
  let best = -Infinity;
  let any = false;
  for (const col of [3, 2, 4, 1, 5, 0, 6]) {
    const r = landingRow(board, col);
    if (r < 0) continue;
    any = true;
    const at = r * COLS + col;
    board[at] = seat;
    const score = winLine(board, at) ? 10000 + depth : -negamax(board, 1 - seat, depth - 1, -beta, -alpha);
    board[at] = null;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}

function FourInRowView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const [hover, setHover] = useState<number | null>(null);
  const current = state.players[state.turn];
  const myTurn = current === me && !finished && !state.drawn;
  const mySeat = state.players.indexOf(me);
  useOnChange(state.lastDrop, (_, next) => next !== null && window.setTimeout(() => play("drop"), 240));

  useEffect(() => {
    if (!state.drawn || finished) return;
    const round = state.round;
    const timer = window.setTimeout(() => act({ type: "next", round }), 1800);
    return () => window.clearTimeout(timer);
  }, [state.drawn, state.round, finished, act]);

  return (
    <div className="board-game c4-game">
      <div className="score-row">
        {state.players.map((player, seat) => (
          <span key={player} className={`score-pill ${player === current && !finished ? "is-turn" : ""}`} style={{ ["--accent" as string]: DISC_COLORS[seat] }}>
            <i className="c4-chip" style={{ background: DISC_COLORS[seat] }} />
            <b>{names[player]}</b>
          </span>
        ))}
      </div>
      <div className="c4-frame" onPointerLeave={() => setHover(null)}>
        <div className="c4-arrows">
          {Array.from({ length: COLS }, (_, col) => (
            <span key={col} className={`c4-arrow ${myTurn && hover === col ? "is-on" : ""}`} style={{ background: DISC_COLORS[Math.max(0, mySeat)] }} />
          ))}
        </div>
        <div className="c4-board">
          {state.board.map((cell, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            return (
              <button
                key={i}
                type="button"
                className={`c4-cell ${state.line?.includes(i) ? "is-line" : ""}`}
                disabled={!myTurn || landingRow(state.board, col) < 0}
                onPointerEnter={() => setHover(col)}
                onClick={() => act({ type: "drop", col })}
                aria-label={`Column ${col + 1}`}
              >
                {cell !== null && (
                  <span
                    key={`${state.round}-${i}`}
                    className={`c4-disc ${state.lastDrop === i ? "is-new" : ""}`}
                    style={{ background: DISC_COLORS[cell], ["--fall" as string]: `${-(row + 1) * 112}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <LogLine log={state.log} names={names} />
      <p className="turn-label">{finished ? "Game over" : state.drawn ? "Board full — new round…" : myTurn ? "Tap a column to drop" : `${names[current]} is thinking…`}</p>
    </div>
  );
}

const empty = () => Array<number | null>(ROWS * COLS).fill(null);

export const fourInRowGame: GameDef<State, Action> = {
  id: "fourinrow",
  title: "Four in a Row",
  tagline: "Drop discs, line up four before they do.",
  emoji: "🟡",
  className: "game-card--c4",
  minPlayers: 2,
  maxPlayers: 2,
  botDelay: 900,
  init: (players) => ({
    players,
    board: empty(),
    turn: 0,
    lastDrop: null,
    line: null,
    drawn: false,
    round: 1,
    log: "Drop a disc into any column.",
    winner: null,
  }),
  apply: (state, action, by) => {
    if (state.winner) return state;
    if (action.type === "next") {
      if (!state.drawn || action.round !== state.round) return state;
      return { ...state, board: empty(), drawn: false, lastDrop: null, line: null, round: state.round + 1, turn: 1 - state.turn, log: "New round!" };
    }
    const seat = state.players.indexOf(by);
    if (seat !== state.turn || state.drawn) return state;
    const row = landingRow(state.board, action.col);
    if (row < 0) return state;
    const board = [...state.board];
    const at = row * COLS + action.col;
    board[at] = seat;
    const line = winLine(board, at);
    if (line) return { ...state, board, lastDrop: at, line, winner: by, log: `${by}|connected four! 🎉` };
    if (board.every((c) => c !== null)) return { ...state, board, lastDrop: at, drawn: true, log: "Board full — it's a draw" };
    return { ...state, board, lastDrop: at, turn: 1 - seat, log: `${by}|dropped in column ${action.col + 1}` };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => (state.drawn ? null : state.players[state.turn]),
  botMove: (state, bot) => {
    const seat = state.players.indexOf(bot);
    const board = [...state.board];
    let best = -1;
    let bestScore = -Infinity;
    for (const col of [3, 2, 4, 1, 5, 0, 6]) {
      const r = landingRow(board, col);
      if (r < 0) continue;
      const at = r * COLS + col;
      board[at] = seat;
      const score = (winLine(board, at) ? 100000 : -negamax(board, 1 - seat, 4, -Infinity, Infinity)) + Math.random() * 3;
      board[at] = null;
      if (score > bestScore) {
        bestScore = score;
        best = col;
      }
    }
    return best >= 0 ? { type: "drop", col: best } : null;
  },
  View: FourInRowView,
};
