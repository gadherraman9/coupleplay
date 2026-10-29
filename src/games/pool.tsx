import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";
import { LogLine, PlayerChips } from "./ui";

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
  // Sounds to play during the replay, keyed by frame index.
  const events: { frame: number; kind: "clack" | "cushion" | "pocket"; vol: number }[] = [];
  const note = (kind: "clack" | "cushion" | "pocket", vol: number) => {
    const frame = frames.length;
    if (!events.some((e) => e.frame === frame && e.kind === kind)) events.push({ frame, kind, vol: Math.min(1, vol) });
  };

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
          note("pocket", 1);
          continue;
        }
        if (b.x < R) { b.x = R; note("cushion", Math.abs(b.vx) / 4); b.vx = -b.vx * 0.85; }
        if (b.x > W - R) { b.x = W - R; note("cushion", Math.abs(b.vx) / 4); b.vx = -b.vx * 0.85; }
        if (b.y < R) { b.y = R; note("cushion", Math.abs(b.vy) / 4); b.vy = -b.vy * 0.85; }
        if (b.y > H - R) { b.y = H - R; note("cushion", Math.abs(b.vy) / 4); b.vy = -b.vy * 0.85; }
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
          note("clack", 0.25 + rel / 5);
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
  return { frames, end, potted, firstHit, events };
}

function drawTable(ctx: CanvasRenderingContext2D, scale: number, balls: Ball[], aim: { angle: number; power: number } | null) {
  const pad = 6 * scale;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  // Wooden rails
  const wood = ctx.createLinearGradient(0, 0, 0, ch);
  wood.addColorStop(0, "#8b4513");
  wood.addColorStop(0.5, "#5c2a0c");
  wood.addColorStop(1, "#3f1d08");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(0, 0, cw, ch, 10 * scale);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,210,150,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, cw - 3, ch - 3, 9 * scale);
  ctx.stroke();
  // Diamonds on the rails
  ctx.fillStyle = "#f5deb3";
  for (let k = 1; k < 8; k += 1) {
    if (k === 4) continue;
    const x = pad + (W * k * scale) / 8;
    for (const y of [pad / 2, ch - pad / 2]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.7 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let k = 1; k < 4; k += 1) {
    const y = pad + (H * k * scale) / 4;
    for (const x of [pad / 2, cw - pad / 2]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.7 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Felt with a soft spotlight
  const felt = ctx.createRadialGradient(pad + (W * scale) / 2, pad + (H * scale) / 2, 10, pad + (W * scale) / 2, pad + (H * scale) / 2, W * scale * 0.65);
  felt.addColorStop(0, "#1fa055");
  felt.addColorStop(1, "#0d5c30");
  ctx.fillStyle = felt;
  ctx.fillRect(pad, pad, W * scale, H * scale);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad + 1, pad + 1, W * scale - 2, H * scale - 2);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + 50 * scale, pad);
  ctx.lineTo(pad + 50 * scale, pad + H * scale);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.arc(pad + 140 * scale, pad + 50 * scale, 0.8 * scale, 0, Math.PI * 2);
  ctx.fill();
  for (const p of POCKETS) {
    const px = pad + p.x * scale;
    const py = pad + p.y * scale;
    const hole = ctx.createRadialGradient(px, py, 0, px, py, p.r * scale);
    hole.addColorStop(0, "#000");
    hole.addColorStop(0.75, "#111");
    hole.addColorStop(1, "#3a3a3a");
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(px, py, p.r * 0.95 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  const cue = balls.find((b) => b.id === 0 && !b.potted);
  if (aim && cue) {
    // Guide line to the first ball or cushion in the aim direction
    const cx = Math.cos(aim.angle);
    const cy = Math.sin(aim.angle);
    let reach = 220;
    let ghost: { x: number; y: number } | null = null;
    for (const b of balls) {
      if (b.potted || b.id === 0) continue;
      const fx = b.x - cue.x;
      const fy = b.y - cue.y;
      const along = fx * cx + fy * cy;
      if (along <= 0) continue;
      const perp2 = fx * fx + fy * fy - along * along;
      if (perp2 > 4 * R * R) continue;
      const hit = along - Math.sqrt(4 * R * R - perp2);
      if (hit < reach) {
        reach = hit;
        ghost = { x: cue.x + cx * hit, y: cue.y + cy * hit };
      }
    }
    const wallT = Math.min(cx > 0 ? (W - R - cue.x) / cx : cx < 0 ? (R - cue.x) / cx : Infinity, cy > 0 ? (H - R - cue.y) / cy : cy < 0 ? (R - cue.y) / cy : Infinity);
    reach = Math.min(reach, wallT);
    ctx.setLineDash([4 * scale, 3 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.5 * scale;
    ctx.beginPath();
    ctx.moveTo(pad + cue.x * scale, pad + cue.y * scale);
    ctx.lineTo(pad + (cue.x + cx * reach) * scale, pad + (cue.y + cy * reach) * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    if (ghost) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(pad + ghost.x * scale, pad + ghost.y * scale, R * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    const back = 4 + aim.power * 14;
    const sx = pad + (cue.x - cx * back) * scale;
    const sy = pad + (cue.y - cy * back) * scale;
    const ex = pad + (cue.x - cx * (back + 70)) * scale;
    const ey = pad + (cue.y - cy * (back + 70)) * scale;
    const stick = ctx.createLinearGradient(sx, sy, ex, ey);
    stick.addColorStop(0, "#f8fafc");
    stick.addColorStop(0.04, "#e8c38f");
    stick.addColorStop(0.7, "#b07a3c");
    stick.addColorStop(0.72, "#1f1630");
    stick.addColorStop(1, "#3b1d0e");
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + 3);
    ctx.lineTo(ex + 2, ey + 3);
    ctx.stroke();
    ctx.strokeStyle = stick;
    ctx.lineWidth = 1.7 * scale;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  for (const b of balls) {
    if (b.potted) continue;
    const x = pad + b.x * scale;
    const y = pad + b.y * scale;
    const r = R * scale;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y + r * 0.35, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    const color = b.id <= 8 ? COLORS[b.id] : COLORS[b.id - 8];
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = b.id > 8 ? "#fbfaf5" : color;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    if (b.id > 8) {
      ctx.fillStyle = color;
      ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1);
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
    const shade = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    shade.addColorStop(0, "rgba(255,255,255,0.55)");
    shade.addColorStop(0.35, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = shade;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
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
  const scale = 4;
  const width = (W + 12) * scale;
  const height = (H + 12) * scale;
  const replay = useMemo(
    () => (state.lastShot ? simulate(state.lastShot.before, state.lastShot.angle, state.lastShot.power) : null),
    [state.lastShot],
  );
  const frames = replay?.frames ?? null;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    if (frames && shownShot.current !== state.shotNo) {
      shownShot.current = state.shotNo;
      setAnimating(true);
      let i = 0;
      let raf = 0;
      const events = replay?.events ?? [];
      play("clack", 0.8);
      const tick = () => {
        drawTable(ctx, scale, frames[Math.min(i, frames.length - 1)], null);
        for (const e of events) if (e.frame === i) play(e.kind, e.vol);
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
      <PlayerChips
        players={state.players}
        current={current}
        names={names}
        color={(_, i) => ["#ec4899", "#8b5cf6"][i]}
        detail={(player) => `${state.groups[player] ?? "open table"} · ${left(player)} left`}
      />
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
