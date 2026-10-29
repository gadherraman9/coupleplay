import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";

// 5 x 5 boxes (odd, so there is always a winner) on a 6 x 6 grid of dots.
const N = 5;
const H_LINES = (N + 1) * N; // horizontal: row 0..N, col 0..N-1
const LINE_COUNT = H_LINES * 2;
const PLAYER_COLORS = ["#ec4899", "#6366f1"];

interface State {
  players: string[];
  lines: (number | null)[];
  boxes: (number | null)[];
  turn: number;
  last: number | null;
  log: string;
  winner: string | null;
}

type Action = { type: "line"; line: number };

const hLine = (r: number, c: number) => r * N + c;
const vLine = (r: number, c: number) => H_LINES + r * (N + 1) + c;
const boxLines = (b: number) => {
  const r = Math.floor(b / N);
  const c = b % N;
  return [hLine(r, c), hLine(r + 1, c), vLine(r, c), vLine(r, c + 1)];
};
const BOXES_OF_LINE: number[][] = Array.from({ length: LINE_COUNT }, (_, line) =>
  Array.from({ length: N * N }, (_, b) => b).filter((b) => boxLines(b).includes(line)),
);
const sides = (lines: (number | null)[], b: number) => boxLines(b).filter((l) => lines[l] !== null).length;

function DotsView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const current = state.players[state.turn];
  const myTurn = current === me && !finished;
  const counts = state.players.map((_, seat) => state.boxes.filter((o) => o === seat).length);
  const drawn = state.lines.filter((l) => l !== null).length;
  const owned = state.boxes.filter((o) => o !== null).length;
  useOnChange(drawn, (prev, next) => next > prev && play("line"));
  useOnChange(owned, (prev, next) => next > prev && play("box"));

  const cell = 100 / N;
  const lineEl = (line: number) => {
    const horizontal = line < H_LINES;
    const idx = horizontal ? line : line - H_LINES;
    const r = horizontal ? Math.floor(idx / N) : Math.floor(idx / (N + 1));
    const c = horizontal ? idx % N : idx % (N + 1);
    const x1 = c * cell;
    const y1 = r * cell;
    const x2 = horizontal ? x1 + cell : x1;
    const y2 = horizontal ? y1 : y1 + cell;
    const owner = state.lines[line];
    const open = owner === null && myTurn;
    return (
      <g key={line} className={`dots-line ${owner !== null ? "is-drawn" : ""} ${open ? "is-open" : ""} ${state.last === line ? "is-last" : ""}`}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="dots-line-track" />
        {owner !== null && <line x1={x1} y1={y1} x2={x2} y2={y2} className="dots-line-ink" stroke={PLAYER_COLORS[owner]} />}
        {open && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="dots-line-hit"
            onClick={() => act({ type: "line", line })}
            role="button"
            aria-label="Draw line"
          />
        )}
      </g>
    );
  };

  return (
    <div className="board-game dots-game">
      <div className="score-row">
        {state.players.map((player, seat) => (
          <span key={player} className={`score-pill ${player === current && !finished ? "is-turn" : ""}`} style={{ ["--accent" as string]: PLAYER_COLORS[seat] }}>
            <i className="c4-chip" style={{ background: PLAYER_COLORS[seat] }} />
            <b>{names[player]}</b>
            <strong>{counts[seat]}</strong>
          </span>
        ))}
      </div>
      <div className="dots-board">
        <svg viewBox="-6 -6 112 112">
          {state.boxes.map((owner, b) =>
            owner === null ? null : (
              <g key={b} className="dots-box">
                <rect x={(b % N) * cell + 1.5} y={Math.floor(b / N) * cell + 1.5} width={cell - 3} height={cell - 3} rx="2.5" fill={PLAYER_COLORS[owner]} />
                <text x={(b % N) * cell + cell / 2} y={Math.floor(b / N) * cell + cell / 2 + 2.6} textAnchor="middle">
                  {(names[state.players[owner]] ?? "?").slice(0, 1).toUpperCase()}
                </text>
              </g>
            ),
          )}
          {Array.from({ length: LINE_COUNT }, (_, line) => lineEl(line))}
          {Array.from({ length: (N + 1) * (N + 1) }, (_, d) => (
            <circle key={d} cx={(d % (N + 1)) * cell} cy={Math.floor(d / (N + 1)) * cell} r="1.9" className="dots-dot" />
          ))}
        </svg>
      </div>
      <LogLine log={state.log} names={names} />
      <p className="turn-label">{finished ? "Game over" : myTurn ? "Tap between two dots" : `${names[current]} is thinking…`}</p>
    </div>
  );
}

export const dotsGame: GameDef<State, Action> = {
  id: "dots",
  title: "Dots & Boxes",
  tagline: "Close a box, take it and go again.",
  emoji: "🔲",
  className: "game-card--dots",
  minPlayers: 2,
  maxPlayers: 2,
  botDelay: 750,
  init: (players) => ({
    players,
    lines: Array(LINE_COUNT).fill(null),
    boxes: Array(N * N).fill(null),
    turn: 0,
    last: null,
    log: "Join two dots. Finish a box to claim it!",
    winner: null,
  }),
  apply: (state, action, by) => {
    const seat = state.players.indexOf(by);
    if (state.winner || seat !== state.turn || state.lines[action.line] !== null) return state;
    const lines = [...state.lines];
    lines[action.line] = seat;
    const boxes = [...state.boxes];
    let made = 0;
    for (const b of BOXES_OF_LINE[action.line]) {
      if (sides(lines, b) === 4 && boxes[b] === null) {
        boxes[b] = seat;
        made += 1;
      }
    }
    const done = boxes.every((o) => o !== null);
    let winner: string | null = null;
    if (done) {
      const mine = boxes.filter((o) => o === seat).length;
      winner = mine * 2 > boxes.length ? by : state.players[1 - seat];
    }
    const log = done
      ? `@[${winner}] wins with ${boxes.filter((o) => o === state.players.indexOf(winner!)).length} boxes!`
      : made
        ? `${by}|closed ${made === 2 ? "two boxes" : "a box"} — goes again`
        : `${by}|drew a line`;
    return { ...state, lines, boxes, last: action.line, turn: made ? seat : 1 - seat, log, winner };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botMove: (state) => {
    const open = state.lines.flatMap((l, i) => (l === null ? [i] : []));
    if (open.length === 0) return null;
    const pick = (list: number[]) => list[Math.floor(Math.random() * list.length)];
    // 1. Take any box that is ready.
    const scoring = open.filter((line) => BOXES_OF_LINE[line].some((b) => sides(state.lines, b) === 3));
    if (scoring.length) return { type: "line", line: pick(scoring) };
    // 2. Play a line that doesn't hand over a box.
    const safe = open.filter((line) => BOXES_OF_LINE[line].every((b) => sides(state.lines, b) < 2));
    if (safe.length) return { type: "line", line: pick(safe) };
    // 3. Give away as little as possible.
    const cost = (line: number) => {
      const lines = [...state.lines];
      lines[line] = 0;
      let given = 0;
      const seen = new Set<number>();
      const stack = BOXES_OF_LINE[line].filter((b) => sides(lines, b) === 3);
      while (stack.length) {
        const b = stack.pop()!;
        if (seen.has(b)) continue;
        seen.add(b);
        given += 1;
        const missing = boxLines(b).find((l) => lines[l] === null);
        if (missing === undefined) continue;
        lines[missing] = 0;
        for (const nb of BOXES_OF_LINE[missing]) if (!seen.has(nb) && sides(lines, nb) === 3) stack.push(nb);
      }
      return given;
    };
    const scored = open.map((line) => ({ line, c: cost(line) + Math.random() * 0.5 }));
    scored.sort((a, b) => a.c - b.c);
    return { type: "line", line: scored[0].line };
  },
  View: DotsView,
};
