import type { GameDef, GameViewProps } from "./types";
import { rollDie } from "./types";
import { play } from "./sfx";
import { Dice, LogLine, PlayerChips, useStepper } from "./ui";

const JUMPS: Record<number, number> = {
  // ladders
  4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92,
  // snakes
  27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 77, 99: 41,
};

export const TOKEN_COLORS = ["#ec4899", "#3b82f6", "#22c55e", "#f59e0b"];
const CELL_COLORS = ["#fde68a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#ddd6fe", "#fed7aa"];
const SNAKE_COLORS = [
  ["#16a34a", "#bef264"],
  ["#dc2626", "#fde047"],
  ["#7c3aed", "#f0abfc"],
  ["#ea580c", "#fef08a"],
  ["#0891b2", "#a5f3fc"],
];

interface State {
  players: string[];
  positions: Record<string, number>;
  turn: number;
  lastRoll: number | null;
  rollNo?: number;
  // Where the last mover landed before a snake or ladder moved them.
  lastMove?: { player: string; landed: number };
  log: string;
  winner: string | null;
}

type Action = { type: "roll" };

function cellCenter(n: number) {
  const index = n - 1;
  const row = Math.floor(index / 10);
  const colInRow = index % 10;
  const col = row % 2 === 0 ? colInRow : 9 - colInRow;
  return { x: col * 10 + 5, y: (9 - row) * 10 + 5 };
}

function Ladder({ from, to }: { from: number; to: number }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 1.7;
  const ny = (dx / len) * 1.7;
  const rungs = Math.max(2, Math.floor(len / 3.6));
  return (
    <g className="ladder" strokeLinecap="round">
      <g stroke="rgba(60,30,0,0.28)" strokeWidth="1.3" transform="translate(0.5 0.7)">
        <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} />
        <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} />
      </g>
      {Array.from({ length: rungs }, (_, r) => {
        const t = (r + 0.5) / rungs;
        return (
          <line key={r} x1={a.x + dx * t + nx} y1={a.y + dy * t + ny} x2={a.x + dx * t - nx} y2={a.y + dy * t - ny} stroke="#b45309" strokeWidth="0.75" />
        );
      })}
      <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} stroke="#92400e" strokeWidth="1.2" />
      <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} stroke="#92400e" strokeWidth="1.2" />
      <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} stroke="#fbbf24" strokeWidth="0.4" />
      <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} stroke="#fbbf24" strokeWidth="0.4" />
    </g>
  );
}

function Snake({ from, to, index }: { from: number; to: number; index: number }) {
  const head = cellCenter(from);
  const tail = cellCenter(to);
  const [body, belly] = SNAKE_COLORS[index % SNAKE_COLORS.length];
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const wiggle = Math.min(6, len / 5);
  const p1 = { x: head.x + dx * 0.33 + nx * wiggle, y: head.y + dy * 0.33 + ny * wiggle };
  const p2 = { x: head.x + dx * 0.66 - nx * wiggle, y: head.y + dy * 0.66 - ny * wiggle };
  const d = `M${head.x} ${head.y} C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${tail.x} ${tail.y}`;
  const angle = (Math.atan2(p1.y - head.y, p1.x - head.x) * 180) / Math.PI + 180;
  return (
    <g className="snake">
      <path d={d} stroke="rgba(0,0,0,0.25)" strokeWidth="3.4" fill="none" strokeLinecap="round" transform="translate(0.5 0.8)" />
      <path d={d} stroke={body} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d={d} stroke={belly} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="0.1 2.4" />
      <path d={d} stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" fill="none" strokeLinecap="round" transform="translate(-0.4 -0.5)" />
      <g transform={`translate(${head.x} ${head.y}) rotate(${angle})`}>
        <path d="M2.4 0 L4.4 -0.6 M2.4 0 L4.4 0.6" stroke="#e11d48" strokeWidth="0.35" strokeLinecap="round" />
        <ellipse rx="2.7" ry="2.1" fill={body} />
        <circle cx="0.9" cy="-1" r="0.7" fill="#fff" />
        <circle cx="0.9" cy="1" r="0.7" fill="#fff" />
        <circle cx="1.1" cy="-1" r="0.35" fill="#111" />
        <circle cx="1.1" cy="1" r="0.35" fill="#111" />
      </g>
    </g>
  );
}

function SnakesView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const current = state.players[state.turn];
  const lastMove = state.lastMove;
  const { shown, busy } = useStepper(state.positions, (player, at, target) => {
    const via = lastMove?.player === player ? lastMove.landed : target;
    if (at < via) {
      play("step");
      return at + 1;
    }
    play(target > at ? "climb" : "slide");
    return target;
  });
  const myTurn = current === me && !finished && !busy;

  return (
    <div className="board-game">
      <div className="snakes-board">
        <div className="snakes-grid">
          {Array.from({ length: 100 }, (_, i) => {
            const row = 9 - Math.floor(i / 10);
            const colIndex = i % 10;
            const n = row * 10 + (row % 2 === 0 ? colIndex : 9 - colIndex) + 1;
            return (
              <span key={n} className={`snakes-cell ${n === 100 ? "is-goal" : ""}`} style={{ background: CELL_COLORS[(row + colIndex * 2) % CELL_COLORS.length] }}>
                {n === 100 ? "👑" : n}
              </span>
            );
          })}
        </div>
        <svg className="snakes-overlay" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            {TOKEN_COLORS.map((color, i) => (
              <radialGradient key={color} id={`pawn-${i}`} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
                <stop offset="35%" stopColor={color} />
                <stop offset="100%" stopColor={color} />
              </radialGradient>
            ))}
          </defs>
          {Object.entries(JUMPS)
            .filter(([from, to]) => to > Number(from))
            .map(([from, to]) => (
              <Ladder key={from} from={Number(from)} to={to} />
            ))}
          {Object.entries(JUMPS)
            .filter(([from, to]) => to < Number(from))
            .map(([from, to], i) => (
              <Snake key={from} from={Number(from)} to={to} index={i} />
            ))}
          {state.players.map((player, index) => {
            const pos = shown[player];
            if (pos < 1) return null;
            const c = cellCenter(pos);
            const offset = [[-2, -1.6], [2, -1.6], [-2, 2], [2, 2]][index];
            const jumping = lastMove?.player === player && pos === state.positions[player] && lastMove.landed !== pos;
            return (
              <g
                key={player}
                className={`pawn ${jumping ? "is-jumping" : ""} ${player === current ? "is-turn" : ""}`}
                style={{ transform: `translate(${c.x + offset[0]}px, ${c.y + offset[1]}px)` }}
              >
                <g key={pos} className="pawn-hop">
                  <ellipse cx="0" cy="2.3" rx="2.4" ry="0.9" fill="rgba(0,0,0,0.28)" />
                  <path d="M-2.1 2 Q-2.2 -0.6 -0.9 -1.2 L0.9 -1.2 Q2.2 -0.6 2.1 2 Z" fill={`url(#pawn-${index})`} stroke="#fff" strokeWidth="0.45" />
                  <circle cx="0" cy="-2.1" r="1.55" fill={`url(#pawn-${index})`} stroke="#fff" strokeWidth="0.45" />
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <PlayerChips
        players={state.players}
        current={current}
        names={names}
        color={(_, i) => TOKEN_COLORS[i]}
        detail={(p) => (shown[p] ? `on ${shown[p]}` : "at start")}
      />

      <LogLine log={state.log} names={names} />
      <div className="board-actions">
        <Dice value={state.lastRoll} nonce={state.rollNo ?? state.log} />
        <button type="button" className={`primary-btn ${myTurn ? "is-ready" : ""}`} disabled={!myTurn} onClick={() => act({ type: "roll" })}>
          {finished ? "Game over" : busy ? "Moving…" : myTurn ? "Roll the dice" : `${names[current]}'s turn`}
        </button>
      </div>
    </div>
  );
}

export const snakesGame: GameDef<State, Action> = {
  id: "snakes",
  title: "Snakes & Ladders",
  tagline: "Climb ladders, dodge snakes, reach 100 first.",
  emoji: "🐍",
  className: "game-card--snakes",
  minPlayers: 2,
  maxPlayers: 4,
  botDelay: 2400,
  init: (players) => ({
    players,
    positions: Object.fromEntries(players.map((p) => [p, 0])),
    turn: 0,
    lastRoll: null,
    rollNo: 0,
    log: "Roll the dice to start. First to 100 wins!",
    winner: null,
  }),
  apply: (state, action, by) => {
    if (state.winner || action.type !== "roll" || state.players[state.turn] !== by) return state;
    const roll = rollDie();
    let pos = state.positions[by] + roll;
    let log = `rolled ${roll}`;
    let landed = pos;
    if (pos > 100) {
      pos = state.positions[by];
      landed = pos;
      log += " — needs an exact roll";
    } else if (JUMPS[pos]) {
      const to = JUMPS[pos];
      log += to > pos ? ` and climbed a ladder to ${to} 🪜` : ` and got bitten by a snake down to ${to} 🐍`;
      pos = to;
    }
    const winner = pos === 100 ? by : null;
    return {
      ...state,
      positions: { ...state.positions, [by]: pos },
      lastRoll: roll,
      rollNo: (state.rollNo ?? 0) + 1,
      lastMove: { player: by, landed },
      turn: winner || roll === 6 ? state.turn : (state.turn + 1) % state.players.length,
      log: `${by}|${log}${roll === 6 && !winner ? " — bonus turn!" : ""}`,
      winner,
    };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botMove: () => ({ type: "roll" }),
  View: SnakesView,
};
