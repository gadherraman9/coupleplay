import type { GameDef, GameViewProps } from "./types";
import { rollDie } from "./types";
import { Dice, LogLine } from "./ui";

const JUMPS: Record<number, number> = {
  // ladders
  4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92,
  // snakes
  27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 77, 99: 41,
};

export const TOKEN_COLORS = ["#ec4899", "#3b82f6", "#22c55e", "#f59e0b"];

interface State {
  players: string[];
  positions: Record<string, number>;
  turn: number;
  lastRoll: number | null;
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

function SnakesView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const current = state.players[state.turn];
  const myTurn = current === me && !finished;
  return (
    <div className="board-game">
      <div className="snakes-board">
        <div className="snakes-grid">
          {Array.from({ length: 100 }, (_, i) => {
            const row = 9 - Math.floor(i / 10);
            const colIndex = i % 10;
            const n = row * 10 + (row % 2 === 0 ? colIndex : 9 - colIndex) + 1;
            return (
              <span key={n} className={`snakes-cell ${(row + colIndex) % 2 ? "is-alt" : ""}`}>
                {n}
              </span>
            );
          })}
        </div>
        <svg className="snakes-overlay" viewBox="0 0 100 100" aria-hidden="true">
          {Object.entries(JUMPS).map(([fromKey, to]) => {
            const from = Number(fromKey);
            const a = cellCenter(from);
            const b = cellCenter(to);
            if (to > from) {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy);
              const nx = (-dy / len) * 1.6;
              const ny = (dx / len) * 1.6;
              const rungs = Math.max(2, Math.floor(len / 4));
              return (
                <g key={from} stroke="#a16207" strokeWidth="0.8" strokeLinecap="round">
                  <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} />
                  <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} />
                  {Array.from({ length: rungs }, (_, r) => {
                    const t = (r + 0.5) / rungs;
                    return (
                      <line
                        key={r}
                        x1={a.x + dx * t + nx}
                        y1={a.y + dy * t + ny}
                        x2={a.x + dx * t - nx}
                        y2={a.y + dy * t - ny}
                      />
                    );
                  })}
                </g>
              );
            }
            const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.25;
            const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.25;
            return (
              <g key={from}>
                <path d={`M${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} stroke="#16a34a" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.85" />
                <path d={`M${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} stroke="#86efac" strokeWidth="0.6" strokeDasharray="1.2 1.6" fill="none" />
                <circle cx={a.x} cy={a.y} r="1.9" fill="#15803d" />
                <circle cx={a.x - 0.6} cy={a.y - 0.5} r="0.4" fill="#fff" />
                <circle cx={a.x + 0.6} cy={a.y - 0.5} r="0.4" fill="#fff" />
              </g>
            );
          })}
          {state.players.map((player, index) => {
            const pos = state.positions[player];
            if (pos < 1) return null;
            const c = cellCenter(pos);
            const offset = [[-2, -2], [2, -2], [-2, 2], [2, 2]][index];
            return (
              <circle
                key={player}
                className="token"
                cx={c.x + offset[0]}
                cy={c.y + offset[1]}
                r="2.4"
                fill={TOKEN_COLORS[index]}
                stroke="#fff"
                strokeWidth="0.7"
              />
            );
          })}
        </svg>
      </div>

      <div className="players-strip">
        {state.players.map((player, index) => (
          <span key={player} className={`player-chip ${player === current ? "is-turn" : ""}`}>
            <i style={{ background: TOKEN_COLORS[index] }} />
            {names[player]} · {state.positions[player] || "start"}
          </span>
        ))}
      </div>

      <LogLine log={state.log} names={names} />
      <div className="board-actions">
        <Dice value={state.lastRoll} />
        <button type="button" className="primary-btn" disabled={!myTurn} onClick={() => act({ type: "roll" })}>
          {finished ? "Game over" : myTurn ? "Roll the dice" : `${names[current]}'s turn`}
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
  init: (players) => ({
    players,
    positions: Object.fromEntries(players.map((p) => [p, 0])),
    turn: 0,
    lastRoll: null,
    log: "Roll the dice to start. First to 100 wins!",
    winner: null,
  }),
  apply: (state, action, by) => {
    if (state.winner || action.type !== "roll" || state.players[state.turn] !== by) return state;
    const roll = rollDie();
    let pos = state.positions[by] + roll;
    let log = `rolled ${roll}`;
    if (pos > 100) {
      pos = state.positions[by];
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
