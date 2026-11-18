import { useState } from "react";
import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";

// Seat 0 starts at the bottom (rows 5-7) and moves up; seat 1 moves down.
interface Piece {
  o: number;
  k: boolean;
}

interface State {
  players: string[];
  board: (Piece | null)[];
  turn: number;
  // Piece that must keep jumping this turn.
  chain: number | null;
  last: { from: number; to: number; captured: number | null } | null;
  quiet: number;
  moves: number;
  log: string;
  winner: string | null;
}

type Action = { type: "move"; from: number; to: number };

interface Move {
  from: number;
  to: number;
  captured: number | null;
}

const PIECE_COLORS = ["#ef4444", "#1f2937"];
const QUIET_LIMIT = 60;

const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function startBoard() {
  return Array.from({ length: 64 }, (_, i): Piece | null => {
    const [r, c] = rc(i);
    if ((r + c) % 2 === 0) return null;
    if (r < 3) return { o: 1, k: false };
    if (r > 4) return { o: 0, k: false };
    return null;
  });
}

function pieceMoves(board: (Piece | null)[], from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];
  const [r, c] = rc(from);
  const dirs = piece.k ? [-1, 1] : [piece.o === 0 ? -1 : 1];
  const out: Move[] = [];
  for (const dr of dirs) {
    for (const dc of [-1, 1]) {
      const r1 = r + dr;
      const c1 = c + dc;
      if (!inside(r1, c1)) continue;
      const mid = board[r1 * 8 + c1];
      if (!mid) {
        out.push({ from, to: r1 * 8 + c1, captured: null });
        continue;
      }
      const r2 = r1 + dr;
      const c2 = c1 + dc;
      if (mid.o !== piece.o && inside(r2, c2) && !board[r2 * 8 + c2]) out.push({ from, to: r2 * 8 + c2, captured: r1 * 8 + c1 });
    }
  }
  return out;
}

// Captures are compulsory: if any jump exists, only jumps are legal.
function legalMoves(state: Pick<State, "board" | "turn" | "chain">): Move[] {
  const sources = state.chain !== null ? [state.chain] : state.board.flatMap((p, i) => (p && p.o === state.turn ? [i] : []));
  const all = sources.flatMap((i) => pieceMoves(state.board, i));
  const jumps = all.filter((m) => m.captured !== null);
  if (state.chain !== null) return jumps;
  return jumps.length ? jumps : all;
}

function material(board: (Piece | null)[], seat: number) {
  return board.reduce((n, p) => n + (p && p.o === seat ? (p.k ? 2 : 1) : 0), 0);
}

function CheckersView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const [selected, setSelected] = useState<number | null>(null);
  const seat = state.players.indexOf(me);
  const flip = seat === 1;
  const current = state.players[state.turn];
  const myTurn = current === me && !finished;
  const legal = myTurn ? legalMoves(state) : [];
  const from = state.chain ?? selected;
  const targets = legal.filter((m) => m.from === from);
  const movable = new Set(legal.map((m) => m.from));
  useOnChange(state.moves, () => {
    if (!state.last) return;
    play(state.last.captured !== null ? "jump" : "place");
    const piece = state.board[state.last.to];
    const [r] = rc(state.last.to);
    if (piece?.k && (r === 0 || r === 7)) window.setTimeout(() => play("king"), 180);
  });

  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i));
  return (
    <div className="board-game checkers-game">
      <div className="score-row">
        {state.players.map((player, s) => (
          <span key={player} className={`score-pill ${player === current && !finished ? "is-turn" : ""}`} style={{ ["--accent" as string]: PIECE_COLORS[s] }}>
            <i className="c4-chip" style={{ background: PIECE_COLORS[s] }} />
            <b>{names[player]}</b>
            <strong>{state.board.filter((p) => p?.o === s).length}</strong>
          </span>
        ))}
      </div>
      <div className="checkers-board">
        {order.map((i) => {
          const [r, c] = rc(i);
          const piece = state.board[i];
          const dark = (r + c) % 2 === 1;
          const target = targets.find((m) => m.to === i);
          const isLast = state.last && (state.last.from === i || state.last.to === i);
          return (
            <button
              key={i}
              type="button"
              className={`ck-cell ${dark ? "is-dark" : ""} ${isLast ? "is-last" : ""} ${target ? "is-target" : ""}`}
              disabled={!myTurn || (!target && !(piece && movable.has(i)))}
              onClick={() => {
                if (target) {
                  act({ type: "move", from: target.from, to: target.to });
                  setSelected(null);
                } else if (piece && movable.has(i) && state.chain === null) {
                  play("tap", 0.6);
                  setSelected(i);
                }
              }}
              aria-label={`Square ${String.fromCharCode(97 + c)}${8 - r}`}
            >
              {piece && (
                <span
                  key={state.last?.to === i ? `m${state.moves}` : "p"}
                  className={`ck-piece ${piece.k ? "is-king" : ""} ${from === i ? "is-selected" : ""} ${movable.has(i) && myTurn ? "is-movable" : ""} ${state.last?.to === i ? "is-moved" : ""}`}
                  style={{ ["--piece" as string]: PIECE_COLORS[piece.o] }}
                >
                  {piece.k && "♛"}
                </span>
              )}
              {target && <span className="ck-dot" />}
            </button>
          );
        })}
      </div>
      <LogLine log={state.log} names={names} />
      <p className="turn-label">
        {finished
          ? "Game over"
          : !myTurn
            ? `${names[current]} is thinking…`
            : state.chain !== null
              ? "Keep jumping!"
              : legal.some((m) => m.captured !== null)
                ? "You must capture!"
                : "Tap a piece, then a square"}
      </p>
    </div>
  );
}

export const checkersGame: GameDef<State, Action> = {
  id: "checkers",
  title: "Checkers",
  tagline: "Jump, capture and crown your kings.",
  emoji: "⚫",
  className: "game-card--checkers",
  minPlayers: 2,
  maxPlayers: 2,
  botDelay: 950,
  init: (players) => ({
    players,
    board: startBoard(),
    turn: 0,
    chain: null,
    last: null,
    quiet: 0,
    moves: 0,
    log: "Move diagonally. Jumps are compulsory!",
    winner: null,
  }),
  apply: (state, action, by) => {
    const seat = state.players.indexOf(by);
    if (state.winner || seat !== state.turn || action.type !== "move") return state;
    const move = legalMoves(state).find((m) => m.from === action.from && m.to === action.to);
    if (!move) return state;
    const board = [...state.board];
    const piece = { ...board[move.from]! };
    board[move.from] = null;
    if (move.captured !== null) board[move.captured] = null;
    const [r] = rc(move.to);
    const crowned = !piece.k && ((piece.o === 0 && r === 0) || (piece.o === 1 && r === 7));
    if (crowned) piece.k = true;
    board[move.to] = piece;
    const base = { ...state, board, last: move, moves: state.moves + 1 };
    // Keep jumping with the same piece (a fresh king stops there).
    if (move.captured !== null && !crowned && pieceMoves(board, move.to).some((m) => m.captured !== null)) {
      return { ...base, chain: move.to, quiet: 0, log: `${by}|captured — jump again!` };
    }
    const other = 1 - seat;
    const quiet = move.captured !== null ? 0 : state.quiet + 1;
    const next = { ...base, chain: null, turn: other, quiet };
    if (legalMoves(next).length === 0) return { ...next, winner: by, log: `${by}|won — no moves left for @[${state.players[other]}] 🏆` };
    if (quiet >= QUIET_LIMIT) {
      const a = material(board, seat);
      const b = material(board, other);
      if (a !== b) {
        const winner = a > b ? by : state.players[other];
        return { ...next, winner, log: `Too many quiet moves — @[${winner}] wins on pieces` };
      }
      return { ...next, board: startBoard(), turn: 0, last: null, quiet: 0, log: "Even game — board reset!" };
    }
    let log = move.captured !== null ? "captured a piece 💥" : "moved";
    if (crowned) log += " and got a king 👑";
    return { ...next, log: `${by}|${log}` };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botMove: (state, bot) => {
    const seat = state.players.indexOf(bot);
    const moves = legalMoves(state);
    if (moves.length === 0) return null;
    const score = (m: Move) => {
      let s = Math.random() * 0.8;
      if (m.captured !== null) s += 5;
      const piece = state.board[m.from]!;
      const [r] = rc(m.to);
      if (!piece.k && ((seat === 0 && r === 0) || (seat === 1 && r === 7))) s += 4;
      // Don't step into an easy capture.
      const board = [...state.board];
      board[m.to] = piece;
      board[m.from] = null;
      if (m.captured !== null) board[m.captured] = null;
      const threatened = board.some((p, i) => p && p.o !== seat && pieceMoves(board, i).some((x) => x.captured === m.to));
      if (threatened) s -= 3.5;
      if (!piece.k) s += (seat === 0 ? 7 - r : r) * 0.1;
      return s;
    };
    const best = moves.reduce((a, b) => (score(b) > score(a) ? b : a));
    return { type: "move", from: best.from, to: best.to };
  },
  View: CheckersView,
};
