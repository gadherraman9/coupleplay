import { useMemo } from "react";
import type { GameDef, GameViewProps } from "./types";
import { pickedSkin, skinArt, tokenLook, useSkin } from "../skins";
import type { SnakeLook, TokenColor } from "../skins";
import { rollDie } from "./types";
import { play } from "./sfx";
import { useSoundTheme } from "./music";
import { Dice, LogLine, PlayerChips, useStepper } from "./ui";

// Each board theme plays on its own layout: from-square -> to-square.
// Ladders go up, snakes go down. The layout is fixed when the game starts
// (from the starter's theme) so everyone plays the same board.
const LAYOUTS: Record<string, Record<number, number>> = {
  classic: { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92, 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 77, 99: 41 },
  jungle: { 3: 22, 8: 30, 28: 55, 36: 44, 51: 67, 58: 77, 71: 91, 80: 98, 17: 7, 32: 10, 48: 26, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75 },
  space: { 2: 38, 7: 14, 15: 26, 21: 42, 49: 72, 63: 86, 78: 97, 16: 6, 46: 25, 56: 33, 64: 41, 82: 59, 92: 69, 96: 54, 99: 80 },
  candy: { 5: 35, 11: 29, 24: 56, 40: 60, 53: 74, 69: 88, 76: 94, 20: 2, 38: 18, 47: 27, 66: 34, 84: 63, 90: 71, 97: 65, 99: 79 },
  desert: { 6: 27, 12: 50, 31: 52, 45: 65, 57: 83, 72: 93, 25: 4, 37: 17, 43: 22, 59: 39, 70: 48, 81: 61, 89: 68, 94: 46, 98: 78 },
  ocean: { 9: 31, 19: 38, 26: 47, 44: 66, 54: 75, 67: 85, 81: 99, 23: 3, 35: 15, 49: 29, 62: 42, 73: 53, 88: 58, 91: 70, 97: 77 },
  spooky: { 4: 16, 10: 33, 29: 45, 52: 71, 61: 82, 74: 90, 18: 2, 27: 8, 39: 20, 48: 30, 56: 37, 66: 46, 79: 59, 87: 55, 93: 64, 96: 76, 99: 41 },
  snow: { 7: 29, 14: 34, 22: 41, 39: 60, 50: 72, 63: 81, 77: 96, 26: 11, 31: 9, 47: 24, 58: 43, 69: 51, 85: 66, 92: 74, 98: 79 },
};
const jumpsOf = (state: State) => LAYOUTS[state.layout ?? "classic"] ?? LAYOUTS.classic;

export const TOKEN_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
const TOKEN_NAMES: TokenColor[] = ["red", "blue", "green", "yellow"];
const CELL_COLORS = ["#fde68a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#ddd6fe", "#fed7aa"];

interface State {
  players: string[];
  positions: Record<string, number>;
  turn: number;
  lastRoll: number | null;
  rollNo?: number;
  layout?: string;
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

const LADDER_WOOD: Record<SnakeLook["ladder"], [string, string, string]> = {
  wood: ["#5b2a0c", "#b45309", "#fbbf24"],
  rope: ["#57340f", "#a16207", "#fde68a"],
  metal: ["#1e293b", "#94a3b8", "#f8fafc"],
  gold: ["#713f12", "#eab308", "#fef9c3"],
  ice: ["#0c4a6e", "#7dd3fc", "#f0f9ff"],
  bone: ["#57534e", "#e7e5e4", "#ffffff"],
  candy: ["#9f1239", "#fff", "#fff"],
};

function Ladder({ from, to, style }: { from: number; to: number; style: SnakeLook["ladder"] }) {
  const a = cellCenter(from);
  const b = cellCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 2;
  const ny = (dx / len) * 2;
  const rungs = Math.max(2, Math.floor(len / 3.4));
  const [dark, mid, light] = LADDER_WOOD[style];
  const rail = (side: 1 | -1) => ({ x1: a.x + nx * side, y1: a.y + ny * side, x2: b.x + nx * side, y2: b.y + ny * side });
  return (
    <g className={`ladder ladder--${style}`} strokeLinecap="round">
      <g stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" transform="translate(0.7 0.9)">
        <line {...rail(1)} />
        <line {...rail(-1)} />
      </g>
      {Array.from({ length: rungs }, (_, r) => {
        const t = (r + 0.5) / rungs;
        const x = a.x + dx * t;
        const y = a.y + dy * t;
        return (
          <g key={r}>
            <line x1={x + nx} y1={y + ny + 0.25} x2={x - nx} y2={y - ny + 0.25} stroke={dark} strokeWidth="1" />
            <line x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} stroke={mid} strokeWidth="0.75" />
            {style === "bone" && (
              <>
                <circle cx={x + nx} cy={y + ny} r="0.55" fill={light} />
                <circle cx={x - nx} cy={y - ny} r="0.55" fill={light} />
              </>
            )}
          </g>
        );
      })}
      {[1, -1].map((side) => (
        <g key={side}>
          <line {...rail(side as 1 | -1)} stroke={dark} strokeWidth="1.5" />
          <line {...rail(side as 1 | -1)} stroke={mid} strokeWidth="1" />
          {style === "candy" && <line {...rail(side as 1 | -1)} stroke="#e11d48" strokeWidth="1" strokeDasharray="1.2 1.2" />}
          {style === "rope" && <line {...rail(side as 1 | -1)} stroke={dark} strokeWidth="0.5" strokeDasharray="0.5 0.7" />}
          <line {...rail(side as 1 | -1)} stroke={light} strokeWidth="0.3" strokeOpacity="0.8" transform="translate(-0.25 -0.25)" />
        </g>
      ))}
    </g>
  );
}

// A tapered, wavy snake body from head (top) to tail, with markings.
function Snake({ from, to, index, look }: { from: number; to: number; index: number; look: SnakeLook }) {
  const head = cellCenter(from);
  const tail = cellCenter(to);
  const [body, belly] = look.colors[index % look.colors.length];
  const shape = useMemo(() => {
    const dx = tail.x - head.x;
    const dy = tail.y - head.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const waves = Math.max(1, Math.round(len / 18)) + 0.5;
    const amp = Math.min(4.5, 1.5 + len / 12) * (index % 2 ? 1 : -1);
    const N = 48;
    const pts = Array.from({ length: N + 1 }, (_, i) => {
      const t = i / N;
      const off = Math.sin(t * Math.PI * 2 * waves) * amp * Math.sin(Math.PI * Math.min(1, t * 1.15));
      return { x: head.x + dx * t + nx * off, y: head.y + dy * t + ny * off, t };
    });
    const width = (t: number) => 3.1 * (t < 0.08 ? 0.82 + t * 2 : 1 - 0.88 * ((t - 0.08) / 0.92) ** 1.4);
    const normals = pts.map((_, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N, i + 1)];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
    });
    const left = pts.map((p, i) => `${(p.x + (normals[i].x * width(p.t)) / 2).toFixed(2)} ${(p.y + (normals[i].y * width(p.t)) / 2).toFixed(2)}`);
    const right = pts.map((p, i) => `${(p.x - (normals[i].x * width(p.t)) / 2).toFixed(2)} ${(p.y - (normals[i].y * width(p.t)) / 2).toFixed(2)}`).reverse();
    const outline = `M${left.join(" L")} L${right.join(" L")} Z`;
    const spine = `M${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L")}`;
    const shine = `M${pts.slice(3, N - 4).map((p, i) => `${(p.x + normals[i + 3].x * width(p.t) * 0.22).toFixed(2)} ${(p.y + normals[i + 3].y * width(p.t) * 0.22).toFixed(2)}`).join(" L")}`;
    const marks = pts.slice(4, N - 2).filter((_, i) => i % 3 === 0).map((p, i) => ({ ...p, w: width(p.t), n: normals[pts.indexOf(p)], i }));
    const angle = (Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x) * 180) / Math.PI;
    return { outline, spine, shine, marks, angle };
  }, [head.x, head.y, tail.x, tail.y, index]);

  return (
    <g className={`snake snake--${look.pattern}`} style={look.pattern === "glow" ? { filter: `drop-shadow(0 0 1.2px ${body})` } : undefined}>
      <path d={shape.outline} fill="rgba(0,0,0,0.3)" transform="translate(0.6 0.9)" />
      <path d={shape.outline} fill={body} stroke="rgba(0,0,0,0.45)" strokeWidth="0.25" strokeLinejoin="round" />
      {look.pattern === "bands" &&
        shape.marks.map((m) => (
          <line key={m.i} x1={m.x + (m.n.x * m.w) / 2} y1={m.y + (m.n.y * m.w) / 2} x2={m.x - (m.n.x * m.w) / 2} y2={m.y - (m.n.y * m.w) / 2} stroke={belly} strokeWidth={m.w * 0.28} />
        ))}
      {look.pattern === "stripes" &&
        shape.marks.map((m) =>
          m.i % 2 ? null : <line key={m.i} x1={m.x + (m.n.x * m.w) / 2} y1={m.y + (m.n.y * m.w) / 2} x2={m.x - (m.n.x * m.w) / 2} y2={m.y - (m.n.y * m.w) / 2} stroke={belly} strokeWidth={m.w * 0.6} />,
        )}
      {look.pattern === "diamond" &&
        shape.marks.map((m) => (
          <rect key={m.i} x={m.x - m.w * 0.22} y={m.y - m.w * 0.22} width={m.w * 0.44} height={m.w * 0.44} fill={belly} stroke="rgba(0,0,0,0.35)" strokeWidth="0.12" transform={`rotate(${45 + (Math.atan2(m.n.y, m.n.x) * 180) / Math.PI} ${m.x} ${m.y})`} />
        ))}
      {look.pattern === "spots" &&
        shape.marks.map((m) => (
          <circle key={m.i} cx={m.x + m.n.x * m.w * (m.i % 2 ? 0.2 : -0.2)} cy={m.y + m.n.y * m.w * (m.i % 2 ? 0.2 : -0.2)} r={m.w * 0.17} fill={belly} />
        ))}
      {look.pattern === "glow" && <path d={shape.spine} fill="none" stroke={belly} strokeWidth="0.5" strokeDasharray="0.3 1.4" strokeLinecap="round" />}
      <path d={shape.shine} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.35" strokeLinecap="round" />
      <g transform={`translate(${head.x} ${head.y}) rotate(${shape.angle})`}>
        <path className="snake-tongue" d="M2.2 0 L3.6 0 L4.3 -0.5 M3.6 0 L4.3 0.5" stroke="#e11d48" strokeWidth="0.3" fill="none" strokeLinecap="round" />
        <path d="M-1.6 -1.55 Q1.2 -2.1 2.5 -0.6 Q2.8 0 2.5 0.6 Q1.2 2.1 -1.6 1.55 Q-2.4 0 -1.6 -1.55 Z" fill={body} stroke="rgba(0,0,0,0.5)" strokeWidth="0.25" />
        <path d="M-0.8 -0.9 Q1 -1.2 1.9 -0.3" stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none" />
        {[-1, 1].map((s) => (
          <g key={s}>
            <ellipse cx="0.9" cy={s * 0.95} rx="0.62" ry="0.5" fill={look.pattern === "glow" ? belly : "#fde047"} stroke="#111" strokeWidth="0.12" />
            <ellipse cx="1" cy={s * 0.95} rx="0.13" ry="0.42" fill="#111" />
            <circle cx="2.25" cy={s * 0.32} r="0.1" fill="#111" />
          </g>
        ))}
      </g>
    </g>
  );
}

function SnakesView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const skin = useSkin("snakes");
  const tokenSkin = useSkin("token");
  useSoundTheme(skin.sound);
  const look = skin.snakes ?? pickedSkin(undefined, "snakes").snakes!;
  const art = skinArt(skin.board);
  const jumps = jumpsOf(state);
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
  const boardStyle = art ? { backgroundImage: `url(${art})`, backgroundColor: skin.tint } : skin.bg ? { background: skin.bg } : skin.tint ? { backgroundColor: skin.tint } : undefined;

  return (
    <div className="board-game">
      <div className={`snakes-board snakes-skin--${skin.id} ${art ? "has-art" : skin.bg ? "has-art has-bg" : ""}`} style={boardStyle}>
        <div className="snakes-grid">
          {Array.from({ length: 100 }, (_, i) => {
            const row = 9 - Math.floor(i / 10);
            const colIndex = i % 10;
            const n = row * 10 + (row % 2 === 0 ? colIndex : 9 - colIndex) + 1;
            return (
              <span key={n} className={`snakes-cell ${n === 100 ? "is-goal" : ""}`} style={{ background: skin.cells ? skin.cells[(row + colIndex) % skin.cells.length] : CELL_COLORS[(row + colIndex * 2) % CELL_COLORS.length] }}>
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
          {Object.entries(jumps)
            .filter(([from, to]) => to > Number(from))
            .map(([from, to]) => (
              <Ladder key={from} from={Number(from)} to={to} style={look.ladder} />
            ))}
          {Object.entries(jumps)
            .filter(([from, to]) => to < Number(from))
            .map(([from, to], i) => (
              <Snake key={`${state.layout}-${from}`} from={Number(from)} to={to} index={i} look={look} />
            ))}
          {state.players.map((player, index) => {
            const pos = shown[player];
            if (pos < 1) return null;
            const c = cellCenter(pos);
            const offset = [[-2, -1.6], [2, -1.6], [-2, 2], [2, 2]][index];
            const jumping = lastMove?.player === player && pos === state.positions[player] && lastMove.landed !== pos;
            const token = tokenLook(tokenSkin, TOKEN_NAMES[index]);
            return (
              <g
                key={player}
                className={`pawn ${jumping ? "is-jumping" : ""} ${player === current ? "is-turn" : ""}`}
                style={{ transform: `translate(${c.x + offset[0]}px, ${c.y + offset[1]}px)` }}
              >
                <g key={pos} className="pawn-hop">
                  <ellipse cx="0" cy="2.3" rx="2.4" ry="0.9" fill="rgba(0,0,0,0.28)" />
                  {token.art ? (
                    <image href={token.art} x="-2.9" y="-6" width="5.8" height="8.6" preserveAspectRatio="xMidYMax meet" />
                  ) : token.emoji ? (
                    <>
                      <circle cx="0" cy="-0.6" r="2.7" fill={`url(#pawn-${index})`} stroke="#fff" strokeWidth="0.45" />
                      <text x="0" y="0.7" textAnchor="middle" fontSize="3.6">{token.emoji}</text>
                    </>
                  ) : (
                    <>
                      <path d="M-2.1 2 Q-2.2 -0.6 -0.9 -1.2 L0.9 -1.2 Q2.2 -0.6 2.1 2 Z" fill={`url(#pawn-${index})`} stroke="#fff" strokeWidth="0.45" />
                      <circle cx="0" cy="-2.1" r="1.55" fill={`url(#pawn-${index})`} stroke="#fff" strokeWidth="0.45" />
                    </>
                  )}
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
  init: (players, host) => {
    const layout = pickedSkin(host?.skins, "snakes").layout ?? "classic";
    return {
      players,
      positions: Object.fromEntries(players.map((p) => [p, 0])),
      turn: 0,
      lastRoll: null,
      rollNo: 0,
      layout,
      log: "Roll the dice to start. First to 100 wins!",
      winner: null,
    };
  },
  apply: (state, action, by) => {
    if (state.winner || action.type !== "roll" || state.players[state.turn] !== by) return state;
    const jumps = jumpsOf(state);
    const roll = rollDie();
    let pos = state.positions[by] + roll;
    let log = `rolled ${roll}`;
    let landed = pos;
    if (pos > 100) {
      pos = state.positions[by];
      landed = pos;
      log += " — needs an exact roll";
    } else if (jumps[pos]) {
      const to = jumps[pos];
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
