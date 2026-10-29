import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameDef, GameViewProps } from "./types";
import { LogLine } from "./ui";

const W = 200;
const H = 100;
const R = 2.6;
const POCKETS = [
  { x: 0, y: 0, r: 5.6 },
  { x: 100, y: -0.5, r: 4.8 },
  { x: 200, y: 0, r: 5.6 },
  { x: 0, y: 100, r: 5.6 },
  { x: 100, y: 100.5, r: 4.8 },
  { x: 200, y: 100, r: 5.6 },
];
const MAX_SPEED = 9;
const SUBSTEPS = 6;
const FRICTION = 0.986;
const CUE_SPOT = { x: 50, y: 50 };
const COLORS = ["#fff", "#facc15", "#2563eb", "#dc2626", "#7c3aed", "#f97316", "#16a34a", "#7f1d1d", "#111"];

interface Ball {
  id: number;
  x: number;
  y: number;
  potted: boolean;
}

type Group = "solids" | "stripes";

interface Shot {
  by: string;
  angle: number;
  power: number;
  before: Ball[];
}

interface State {
  players: string[];
  balls: Ball[];
  turn: number;
  groups: Record<string, Group | null>;
  lastShot: Shot | null;
  shotNo: number;
  log: string;
  winner: string | null;
}

type Action = { type: "shoot"; angle: number; power: number };

const groupOf = (id: number): Group | null => (id >= 1 && id <= 7 ? "solids" : id >= 9 ? "stripes" : null);

function rack(): Ball[] {
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const balls: Ball[] = [{ id: 0, ...CUE_SPOT, potted: false }];
  let k = 0;
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      balls.push({
        id: order[k++],
        x: 140 + row * (2 * R * 0.87 + 0.15),
        y: 50 + (i - row / 2) * (2 * R + 0.15),
        potted: false,
      });
    }
  }
  return balls;
}

// Deterministic physics: every client replays the same shot to animate it.
export function simulate(start: Ball[], angle: number, power: number) {
  const balls = start.map((b) => ({ ...b, vx: 0, vy: 0 }));
  const cue = balls.find((b) => b.id === 0)!;
  const speed = Math.max(0.5, Math.min(1, power)) * MAX_SPEED;
  cue.vx = Math.cos(angle) * speed;
  cue.vy = Math.sin(angle) * speed;
  const frames: Ball[][] = [];
  const potted: number[] = [];
  let firstHit: number | null = null;

  for (let frame = 0; frame < 2000; frame += 1) {
    let moving = false;
    for (let s = 0; s < SUBSTEPS; s += 1) {
      for (const b of balls) {
        if (b.potted) continue;
        b.x += b.vx / SUBSTEPS;
        b.y += b.vy / SUBSTEPS;
        const pocket = POCKETS.find((p) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < p.r * p.r);
        if (pocket) {
          b.potted = true;
          b.vx = 0;
          b.vy = 0;
          potted.push(b.id);
          continue;
        }
        if (b.x < R) { b.x = R; b.vx = -b.vx * 0.85; }
        if (b.x > W - R) { b.x = W - R; b.vx = -b.vx * 0.85; }
        if (b.y < R) { b.y = R; b.vy = -b.vy * 0.85; }
        if (b.y > H - R) { b.y = H - R; b.vy = -b.vy * 0.85; }
      }
      for (let i = 0; i < balls.length; i += 1) {
        const a = balls[i];
        if (a.potted) continue;
        for (let j = i + 1; j < balls.length; j += 1) {
          const b = balls[j];
          if (b.potted) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= 4 * R * R || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const overlap = 2 * R - d;
          a.x -= (nx * overlap) / 2;
          a.y -= (ny * overlap) / 2;
          b.x += (nx * overlap) / 2;
          b.y += (ny * overlap) / 2;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          const impulse = rel * 0.98;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
          if (firstHit === null && (a.id === 0 || b.id === 0)) firstHit = a.id === 0 ? b.id : a.id;
        }
      }
    }
    for (const b of balls) {
      if (b.potted) continue;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      if (b.vx * b.vx + b.vy * b.vy < 0.0009) {
        b.vx = 0;
        b.vy = 0;
      } else moving = true;
    }
    if (frame % 2 === 0) frames.push(balls.map(({ id, x, y, potted: p }) => ({ id, x, y, potted: p })));
    if (!moving) break;
  }
  const end = balls.map(({ id, x, y, potted: p }) => ({ id, x, y, potted: p }));
  frames.push(end);
  return { frames, end, potted, firstHit };
}

function drawTable(ctx: CanvasRenderingContext2D, scale: number, balls: Ball[], aim: { angle: number; power: number } | null) {
  const pad = 6 * scale;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#7c2d12";
  ctx.beginPath();
  ctx.roundRect(0, 0, ctx.canvas.width, ctx.canvas.height, 10 * scale);
  ctx.fill();
  ctx.fillStyle = "#15803d";
  ctx.fillRect(pad, pad, W * scale, H * scale);
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(pad + 50 * scale, pad);
  ctx.lineTo(pad + 50 * scale, pad + H * scale);
  ctx.stroke();
  ctx.fillStyle = "#0b0b0b";
  for (const p of POCKETS) {
    ctx.beginPath();
    ctx.arc(pad + p.x * scale, pad + p.y * scale, p.r * 0.95 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  const cue = balls.find((b) => b.id === 0 && !b.potted);
  if (aim && cue) {
    ctx.setLineDash([4 * scale, 3 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 0.6 * scale;
    ctx.beginPath();
    ctx.moveTo(pad + cue.x * scale, pad + cue.y * scale);
    ctx.lineTo(pad + (cue.x + Math.cos(aim.angle) * 60) * scale, pad + (cue.y + Math.sin(aim.angle) * 60) * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    const back = 4 + aim.power * 14;
    ctx.strokeStyle = "#d6a76c";
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(pad + (cue.x - Math.cos(aim.angle) * back) * scale, pad + (cue.y - Math.sin(aim.angle) * back) * scale);
    ctx.lineTo(pad + (cue.x - Math.cos(aim.angle) * (back + 60)) * scale, pad + (cue.y - Math.sin(aim.angle) * (back + 60)) * scale);
    ctx.stroke();
  }
  for (const b of balls) {
    if (b.potted) continue;
    const x = pad + b.x * scale;
    const y = pad + b.y * scale;
    const r = R * scale;
    const color = b.id <= 8 ? COLORS[b.id] : COLORS[b.id - 8];
    ctx.fillStyle = b.id > 8 ? "#fff" : color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (b.id > 8) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1);
      ctx.restore();
    }
    if (b.id > 0) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = `bold ${r * 0.62}px Nunito, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(b.id), x, y + 0.3);
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function PoolView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0.6);
  const [animating, setAnimating] = useState(false);
  const shownShot = useRef(state.shotNo);
  const current = state.players[state.turn];
  const myTurn = current === me && !finished && !animating;
  const scale = 1.8;
  const width = (W + 12) * scale;
  const height = (H + 12) * scale;
  const frames = useMemo(
    () => (state.lastShot ? simulate(state.lastShot.before, state.lastShot.angle, state.lastShot.power).frames : null),
    [state.lastShot],
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    if (frames && shownShot.current !== state.shotNo) {
      shownShot.current = state.shotNo;
      setAnimating(true);
      let i = 0;
      let raf = 0;
      const tick = () => {
        drawTable(ctx, scale, frames[Math.min(i, frames.length - 1)], null);
        i += 1;
        if (i < frames.length) raf = requestAnimationFrame(tick);
        else {
          drawTable(ctx, scale, state.balls, null);
          setAnimating(false);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    if (!animating) drawTable(ctx, scale, state.balls, myTurn ? { angle: aimAngle, power } : null);
  }, [state.shotNo, state.balls, frames, aimAngle, power, myTurn, animating]);

  const aimAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!myTurn) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * (W + 12) - 6;
    const y = ((event.clientY - rect.top) / rect.height) * (H + 12) - 6;
    const cue = state.balls.find((b) => b.id === 0)!;
    setAimAngle(Math.atan2(y - cue.y, x - cue.x));
  };

  const myGroup = state.groups[me];
  const left = (player: string) => {
    const group = state.groups[player];
    if (!group) return 7;
    return state.balls.filter((b) => !b.potted && groupOf(b.id) === group).length;
  };

  return (
    <div className="board-game pool-game">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="pool-canvas"
        onPointerDown={aimAt}
        onPointerMove={(event) => event.buttons && aimAt(event)}
      />
      <div className="players-strip">
        {state.players.map((player) => (
          <span key={player} className={`player-chip ${player === current ? "is-turn" : ""}`}>
            {names[player]} · {state.groups[player] ?? "open table"} · {left(player)} left
          </span>
        ))}
      </div>
      <LogLine log={state.log} names={names} />
      <div className="pool-controls">
        <label>
          Power
          <input type="range" min={0.1} max={1} step={0.05} value={power} onChange={(e) => setPower(Number(e.target.value))} disabled={!myTurn} />
        </label>
        <button type="button" className="primary-btn" disabled={!myTurn} onClick={() => act({ type: "shoot", angle: aimAngle, power })}>
          {finished ? "Game over" : animating ? "Rolling…" : myTurn ? "Shoot" : `${names[current]} is aiming…`}
        </button>
      </div>
      <p className="game-hint">Tap or drag on the table to aim. {myGroup ? `You are ${myGroup}.` : "First ball you pot picks your group."}</p>
    </div>
  );
}

export const poolGame: GameDef<State, Action> = {
  id: "pool",
  title: "8-Ball Pool",
  tagline: "Pot your group, then sink the black.",
  emoji: "🎱",
  className: "game-card--pool",
  minPlayers: 2,
  maxPlayers: 2,
  botDelay: 4200,
  init: (players) => ({
    players,
    balls: rack(),
    turn: 0,
    groups: Object.fromEntries(players.map((p) => [p, null])),
    lastShot: null,
    shotNo: 0,
    log: "Break! Tap the table to aim, set power, then shoot.",
    winner: null,
  }),
  apply: (state, action, by) => {
    if (state.winner || state.players[state.turn] !== by || action.type !== "shoot") return state;
    const { end, potted, firstHit } = simulate(state.balls, action.angle, action.power);
    const other = state.players[(state.turn + 1) % 2];
    const groups = { ...state.groups };
    const cuePotted = potted.includes(0);
    const objectPotted = potted.filter((id) => id !== 0 && id !== 8);
    let balls = end;
    let log = potted.length ? `potted ${potted.filter((id) => id !== 0).join(", ") || "nothing"}` : "missed";
    if (!groups[by] && objectPotted.length) {
      const group = groupOf(objectPotted[0])!;
      groups[by] = group;
      groups[other] = group === "solids" ? "stripes" : "solids";
      log += ` and takes ${group}`;
    }
    if (cuePotted) {
      balls = balls.map((b) => (b.id === 0 ? { ...b, potted: false, ...CUE_SPOT } : b));
      log += " — scratch! cue ball potted";
    }
    const base = { ...state, balls, groups, lastShot: { by, ...action, before: state.balls }, shotNo: state.shotNo + 1 };

    if (potted.includes(8)) {
      const mine = groups[by];
      const cleared = mine !== null && end.filter((b) => !b.potted && groupOf(b.id) === mine).length === 0;
      const won = cleared && !cuePotted;
      return { ...base, winner: won ? by : other, log: won ? `${by}|sank the black and won! 🎱` : `${by}|sank the black too early — @[${other}] wins` };
    }
    const mine = groups[by];
    const pottedOwn = objectPotted.some((id) => !mine || groupOf(id) === mine);
    const foul = cuePotted || firstHit === null;
    const keepTurn = pottedOwn && !foul;
    if (firstHit === null && !cuePotted) log += " — didn't hit any ball";
    return { ...base, turn: keepTurn ? state.turn : (state.turn + 1) % 2, log: `${by}|${log}${keepTurn ? " — shoots again" : ""}` };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botMove: (state, bot) => {
    const cue = state.balls.find((b) => b.id === 0)!;
    const group = state.groups[bot];
    let targets = state.balls.filter((b) => !b.potted && b.id !== 0 && (group ? groupOf(b.id) === group : b.id !== 8));
    if (targets.length === 0) targets = state.balls.filter((b) => b.id === 8 && !b.potted);
    let best: { angle: number; cost: number } | null = null;
    for (const t of targets) {
      for (const p of POCKETS) {
        const dx = p.x - t.x;
        const dy = p.y - t.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const gx = t.x - (dx / d) * 2 * R;
        const gy = t.y - (dy / d) * 2 * R;
        const cx = gx - cue.x;
        const cy = gy - cue.y;
        const cd = Math.sqrt(cx * cx + cy * cy);
        const cut = Math.abs(Math.atan2(dy, dx) - Math.atan2(cy, cx));
        const cost = cd + d + Math.min(cut, Math.PI * 2 - cut) * 60;
        if (!best || cost < best.cost) best = { angle: Math.atan2(cy, cx), cost };
      }
    }
    const angle = (best?.angle ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 0.05;
    return { type: "shoot", angle, power: 0.55 + Math.random() * 0.3 };
  },
  View: PoolView,
};
