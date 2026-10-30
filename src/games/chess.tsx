import { useEffect, useMemo, useState } from "react";
import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";
import { skinArt } from "../skins";

function PieceImg({ piece, className = "" }: { piece: Piece; className?: string }) {
  const art = skinArt(`chess-${piece}.webp`);
  if (!art) return <span className={`chess-glyph chess-glyph--${piece[0]} ${className}`}>{GLYPH[piece[1] as Kind]}</span>;
  return <img className={`chess-piece ${className}`} src={art} alt="" draggable={false} />;
}

// Full chess rules: castling, en passant, promotion, check, mate, stalemate,
// the 50-move rule and bare-king draws. A draw replays with colours swapped.

type Color = "w" | "b";
type Kind = "P" | "N" | "B" | "R" | "Q" | "K";
type Piece = `${Color}${Kind}`;
type Board = (Piece | null)[];

interface Move {
  from: number;
  to: number;
  promo?: Kind;
  castle?: boolean;
  ep?: boolean;
}

interface Pos {
  board: Board;
  turn: Color;
  castling: string;
  ep: number | null;
  half: number;
}

interface State extends Pos {
  players: string[];
  // players[white] plays white this game.
  white: number;
  game: number;
  last: Move | null;
  captured: Piece[];
  check: boolean;
  over: { result: "mate" | "draw" | "resign"; reason: string } | null;
  log: string;
  winner: string | null;
}

type Action = { type: "move"; from: number; to: number; promo?: Kind } | { type: "resign" } | { type: "next"; game: number };

const GLYPH: Record<Kind, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const VALUE: Record<Kind, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const NAME: Record<Kind, string> = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };

const row = (i: number) => i >> 3;
const col = (i: number) => i & 7;
const sq = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
const sqName = (i: number) => `${"abcdefgh"[col(i)]}${8 - row(i)}`;

function startBoard(): Board {
  const back: Kind[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const b: Board = Array(64).fill(null);
  back.forEach((k, c) => {
    b[c] = `b${k}`;
    b[56 + c] = `w${k}`;
    b[8 + c] = "bP";
    b[48 + c] = "wP";
  });
  return b;
}

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function attacked(board: Board, target: number, by: Color) {
  const r = row(target);
  const c = col(target);
  const dir = by === "w" ? 1 : -1;
  for (const dc of [-1, 1]) {
    const s = sq(r + dir, c + dc);
    if (s >= 0 && board[s] === `${by}P`) return true;
  }
  for (const [dr, dc] of KNIGHT) {
    const s = sq(r + dr, c + dc);
    if (s >= 0 && board[s] === `${by}N`) return true;
  }
  for (const [dr, dc] of KING) {
    const s = sq(r + dr, c + dc);
    if (s >= 0 && board[s] === `${by}K`) return true;
  }
  for (const [dirs, kinds] of [[DIAG, "BQ"], [ORTHO, "RQ"]] as const) {
    for (const [dr, dc] of dirs) {
      for (let k = 1; k < 8; k += 1) {
        const s = sq(r + dr * k, c + dc * k);
        if (s < 0) break;
        const p = board[s];
        if (p) {
          if (p[0] === by && kinds.includes(p[1])) return true;
          break;
        }
      }
    }
  }
  return false;
}

const kingSq = (board: Board, color: Color) => board.indexOf(`${color}K`);
const enemy = (c: Color): Color => (c === "w" ? "b" : "w");
const inCheck = (pos: Pos, color = pos.turn) => attacked(pos.board, kingSq(pos.board, color), enemy(color));

function pseudoMoves(pos: Pos): Move[] {
  const { board, turn } = pos;
  const moves: Move[] = [];
  for (let from = 0; from < 64; from += 1) {
    const p = board[from];
    if (!p || p[0] !== turn) continue;
    const kind = p[1] as Kind;
    const r = row(from);
    const c = col(from);
    const add = (to: number) => {
      if (kind === "P" && (row(to) === 0 || row(to) === 7)) (["Q", "R", "B", "N"] as Kind[]).forEach((promo) => moves.push({ from, to, promo }));
      else moves.push({ from, to });
    };
    if (kind === "P") {
      const dir = turn === "w" ? -1 : 1;
      const one = sq(r + dir, c);
      if (one >= 0 && !board[one]) {
        add(one);
        const two = sq(r + dir * 2, c);
        if ((turn === "w" ? r === 6 : r === 1) && !board[two]) moves.push({ from, to: two });
      }
      for (const dc of [-1, 1]) {
        const t = sq(r + dir, c + dc);
        if (t < 0) continue;
        if (board[t] && board[t]![0] !== turn) add(t);
        else if (t === pos.ep) moves.push({ from, to: t, ep: true });
      }
    } else if (kind === "N" || kind === "K") {
      for (const [dr, dc] of kind === "N" ? KNIGHT : KING) {
        const t = sq(r + dr, c + dc);
        if (t >= 0 && (!board[t] || board[t]![0] !== turn)) moves.push({ from, to: t });
      }
      if (kind === "K") {
        const home = turn === "w" ? 60 : 4;
        const rights = turn === "w" ? ["K", "Q"] : ["k", "q"];
        if (from === home && !attacked(board, home, enemy(turn))) {
          if (pos.castling.includes(rights[0]) && !board[home + 1] && !board[home + 2] && board[home + 3] === `${turn}R` && !attacked(board, home + 1, enemy(turn)))
            moves.push({ from, to: home + 2, castle: true });
          if (pos.castling.includes(rights[1]) && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === `${turn}R` && !attacked(board, home - 1, enemy(turn)))
            moves.push({ from, to: home - 2, castle: true });
        }
      }
    } else {
      const dirs = kind === "B" ? DIAG : kind === "R" ? ORTHO : [...DIAG, ...ORTHO];
      for (const [dr, dc] of dirs) {
        for (let k = 1; k < 8; k += 1) {
          const t = sq(r + dr * k, c + dc * k);
          if (t < 0) break;
          if (board[t]) {
            if (board[t]![0] !== turn) moves.push({ from, to: t });
            break;
          }
          moves.push({ from, to: t });
        }
      }
    }
  }
  return moves;
}

function makeMove(pos: Pos, m: Move): Pos {
  const board = [...pos.board];
  const p = board[m.from]!;
  const captured = board[m.to];
  board[m.to] = m.promo ? (`${pos.turn}${m.promo}` as Piece) : p;
  board[m.from] = null;
  if (m.ep) board[m.to + (pos.turn === "w" ? 8 : -8)] = null;
  if (m.castle) {
    const rookFrom = m.to > m.from ? m.to + 1 : m.to - 2;
    const rookTo = m.to > m.from ? m.to - 1 : m.to + 1;
    board[rookTo] = board[rookFrom];
    board[rookFrom] = null;
  }
  let castling = pos.castling;
  const strip = (s: number) => {
    if (s === 60 || s === 63) castling = castling.replace("K", "");
    if (s === 60 || s === 56) castling = castling.replace("Q", "");
    if (s === 4 || s === 7) castling = castling.replace("k", "");
    if (s === 4 || s === 0) castling = castling.replace("q", "");
  };
  strip(m.from);
  strip(m.to);
  const ep = p[1] === "P" && Math.abs(m.to - m.from) === 16 ? (m.to + m.from) / 2 : null;
  return { board, turn: enemy(pos.turn), castling, ep, half: p[1] === "P" || captured ? 0 : pos.half + 1 };
}

function legalMoves(pos: Pos) {
  return pseudoMoves(pos).filter((m) => !inCheck(makeMove(pos, m), pos.turn));
}

function bareKings(board: Board) {
  const rest = board.filter((p) => p && p[1] !== "K") as Piece[];
  return rest.length === 0 || (rest.length === 1 && "NB".includes(rest[0][1]));
}

// ---------- bot: alpha-beta with simple piece-square bonuses ----------

const CENTER = Array.from({ length: 64 }, (_, i) => {
  const dr = Math.abs(3.5 - row(i));
  const dc = Math.abs(3.5 - col(i));
  return Math.round((7 - dr - dc) * 4);
});

function evaluate(pos: Pos, me: Color) {
  let score = 0;
  pos.board.forEach((p, i) => {
    if (!p) return;
    const kind = p[1] as Kind;
    let v = VALUE[kind];
    if (kind === "N" || kind === "B") v += CENTER[i];
    if (kind === "P") v += (p[0] === "w" ? 6 - row(i) : row(i) - 1) * 8 + CENTER[i] / 2;
    if (kind === "Q") v += CENTER[i] / 3;
    score += p[0] === me ? v : -v;
  });
  return score;
}

function search(pos: Pos, depth: number, alpha: number, beta: number, me: Color): number {
  if (depth === 0) return evaluate(pos, me);
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos) ? (pos.turn === me ? -100000 - depth : 100000 + depth) : 0;
  moves.sort((a, b) => (pos.board[b.to] ? VALUE[pos.board[b.to]![1] as Kind] : 0) - (pos.board[a.to] ? VALUE[pos.board[a.to]![1] as Kind] : 0));
  const maxing = pos.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const v = search(makeMove(pos, m), depth - 1, alpha, beta, me);
    if (maxing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function botChoice(pos: Pos) {
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  const pieces = pos.board.filter(Boolean).length;
  const depth = pieces < 12 ? 3 : 2;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    // A little noise keeps the bot human (and beatable).
    const v = search(makeMove(pos, m), depth, -Infinity, Infinity, pos.turn) + Math.random() * 30;
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
  }
  return best;
}

// ---------- game ----------

function newGame(players: string[], white: number, game: number): State {
  return {
    players,
    white,
    game,
    board: startBoard(),
    turn: "w",
    castling: "KQkq",
    ep: null,
    half: 0,
    last: null,
    captured: [],
    check: false,
    over: null,
    log: game === 1 ? "White moves first. Tap a piece, then a square." : `Game ${game} — colours swapped!`,
    winner: null,
  };
}

const colorOf = (state: State, player: string): Color => (state.players.indexOf(player) === state.white ? "w" : "b");
const playerOf = (state: State, color: Color) => state.players[color === "w" ? state.white : 1 - state.white];

function ChessView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const myColor = colorOf(state, me);
  const flip = myColor === "b";
  const myTurn = !finished && !state.over && state.turn === myColor;
  const [picked, setPicked] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const moves = useMemo(() => (myTurn ? legalMoves(state) : []), [state, myTurn]);
  const targets = picked === null ? [] : moves.filter((m) => m.from === picked);
  const isHost = state.players[0] === me;

  useEffect(() => setPicked(null), [state.last]);
  useOnChange(state.captured.length, (prev, next) => next > prev && play("capture", 0.6));
  useOnChange(state.last, (_, m) => m && play(state.check ? "check" : "place"));

  useEffect(() => {
    if (state.over?.result !== "draw" || finished) return;
    const game = state.game;
    const timer = window.setTimeout(() => act({ type: "next", game }), isHost ? 2600 : 6000);
    return () => window.clearTimeout(timer);
  }, [state.over, state.game, finished, act, isHost]);

  const tap = (i: number) => {
    if (!myTurn) return;
    const target = targets.find((m) => m.to === i);
    if (target && picked !== null) {
      if (target.promo) setPromo({ from: picked, to: i });
      else act({ type: "move", from: picked, to: i });
      setPicked(null);
      return;
    }
    const p = state.board[i];
    setPicked(p && p[0] === myColor && picked !== i ? i : null);
    if (p && p[0] === myColor) play("tap");
  };

  const king = state.check ? kingSq(state.board, state.turn) : -1;
  const lost = (c: Color) => state.captured.filter((p) => p[0] === c);
  const Tray = ({ color }: { color: Color }) => (
    <span className="chess-tray">
      {lost(color).map((p, i) => (
        <PieceImg key={i} piece={p} className="chess-piece--tray" />
      ))}
    </span>
  );
  const opponent = playerOf(state, enemy(myColor));

  return (
    <div className="board-game chess-game">
      <div className={`chess-side ${state.turn !== myColor && !state.over ? "is-turn" : ""}`}>
        <b>{names[opponent]}</b> <small>{enemy(myColor) === "w" ? "White" : "Black"}</small>
        <Tray color={myColor} />
      </div>
      <div className="chess-board" style={{ ["--wood-light" as string]: skinArt("wood-light.webp") ? `url(${skinArt("wood-light.webp")})` : "none", ["--wood-dark" as string]: skinArt("wood-dark.webp") ? `url(${skinArt("wood-dark.webp")})` : "none" }}>
        {Array.from({ length: 64 }, (_, k) => {
          const i = flip ? 63 - k : k;
          const p = state.board[i];
          const dark = (row(i) + col(i)) % 2 === 1;
          const isTarget = targets.some((m) => m.to === i);
          const isLast = state.last && (state.last.from === i || state.last.to === i);
          return (
            <button
              key={i}
              type="button"
              className={`chess-sq ${dark ? "is-dark" : "is-light"} ${picked === i ? "is-picked" : ""} ${isLast ? "is-last" : ""} ${i === king ? "is-check" : ""} ${isTarget ? (p ? "is-capture" : "is-target") : ""}`}
              onClick={() => tap(i)}
              aria-label={`${sqName(i)}${p ? ` ${p[0] === "w" ? "white" : "black"} ${NAME[p[1] as Kind]}` : ""}`}
            >
              {p && (
                <PieceImg key={`${p}-${state.last?.to === i ? state.game * 1000 + state.captured.length + (state.last?.from ?? 0) : "s"}`} piece={p} className={state.last?.to === i ? "is-moved" : ""} />
              )}
              {(flip ? col(i) === 7 : col(i) === 0) && <small className="chess-rank">{8 - row(i)}</small>}
              {(flip ? row(i) === 0 : row(i) === 7) && <small className="chess-file">{"abcdefgh"[col(i)]}</small>}
            </button>
          );
        })}
        {promo && (
          <div className="chess-promo" role="dialog" aria-label="Promote pawn">
            {(["Q", "R", "B", "N"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  act({ type: "move", from: promo.from, to: promo.to, promo: k });
                  setPromo(null);
                }}
              >
                <PieceImg piece={`${myColor}${k}` as Piece} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`chess-side ${myTurn ? "is-turn" : ""}`}>
        <b>You</b> <small>{myColor === "w" ? "White" : "Black"}</small>
        <Tray color={enemy(myColor)} />
      </div>
      <LogLine log={state.log} names={names} />
      <div className="board-actions">
        <p className="turn-label">
          {finished ? "Game over" : state.over ? "Draw — new game…" : myTurn ? (state.check ? "Check! Save your king" : "Your move") : `${names[opponent]} is thinking…`}
        </p>
        {!finished && !state.over && (
          <button type="button" className="ghost-btn ghost-btn--small" onClick={() => window.confirm("Resign this game?") && act({ type: "resign" })}>
            Resign
          </button>
        )}
      </div>
    </div>
  );
}

export const chessGame: GameDef<State, Action> = {
  id: "chess",
  title: "Chess",
  tagline: "The classic. Checkmate the king to win.",
  emoji: "♟️",
  className: "game-card--chess has-cover",
  minPlayers: 2,
  maxPlayers: 2,
  botDelay: 700,
  init: (players) => newGame(players, 0, 1),
  apply: (state, action, by) => {
    if (state.winner) return state;
    if (action.type === "next") {
      if (state.over?.result !== "draw" || action.game !== state.game) return state;
      return newGame(state.players, 1 - state.white, state.game + 1);
    }
    if (state.over) return state;
    const color = colorOf(state, by);
    if (action.type === "resign") {
      const other = playerOf(state, enemy(color));
      return { ...state, over: { result: "resign", reason: "resigned" }, winner: other, log: `${by}|resigned. @[${other}] wins! 🏆` };
    }
    if (color !== state.turn) return state;
    const move = legalMoves(state).find((m) => m.from === action.from && m.to === action.to && (!m.promo || m.promo === (action.promo ?? "Q")));
    if (!move) return state;
    const piece = state.board[move.from]!;
    const taken = move.ep ? state.board[move.to + (color === "w" ? 8 : -8)] : state.board[move.to];
    const pos = makeMove(state, move);
    const check = inCheck(pos);
    const replies = legalMoves(pos).length;
    let log = move.castle ? "castled" : `${NAME[piece[1] as Kind]} ${sqName(move.from)}→${sqName(move.to)}`;
    if (taken) log += ` takes ${NAME[taken[1] as Kind]}`;
    if (move.promo) log += ` and promotes to ${NAME[move.promo]}`;
    const next: State = { ...state, ...pos, last: move, captured: taken ? [...state.captured, taken] : state.captured, check, log: `${by}|${log}${check ? " — check!" : ""}` };
    if (replies === 0 && check) return { ...next, over: { result: "mate", reason: "checkmate" }, winner: by, log: `${by}|checkmate! 🏆` };
    if (replies === 0) return { ...next, over: { result: "draw", reason: "stalemate" }, log: "Stalemate — it's a draw" };
    if (pos.half >= 100) return { ...next, over: { result: "draw", reason: "50 moves" }, log: "50 moves without a capture — draw" };
    if (bareKings(pos.board)) return { ...next, over: { result: "draw", reason: "material" }, log: "Not enough pieces to mate — draw" };
    return next;
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => (state.over ? null : playerOf(state, state.turn)),
  botMove: (state) => {
    const m = botChoice(state);
    return m ? { type: "move", from: m.from, to: m.to, promo: m.promo } : null;
  },
  View: ChessView,
};
