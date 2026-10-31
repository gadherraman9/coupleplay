import { useEffect, useRef, useState } from "react";
import { play } from "./sfx";
import { skinArt, useSkin } from "../skins";
import type { DiceLook } from "../skins";

const DIE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const DICE_ROLL_MS = 620;

// `nonce` changes on every roll (even a repeat of the same number), which
// starts the tumble animation and the rattle sound.
export function Dice({ value, small, nonce }: { value: number | null; small?: boolean; nonce?: string | number }) {
  const [face, setFace] = useState(value);
  const [rolling, setRolling] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setFace(value);
      return;
    }
    if (!value) {
      setFace(value);
      return;
    }
    setRolling(true);
    play("roll");
    const spin = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    const stop = window.setTimeout(() => {
      window.clearInterval(spin);
      setFace(value);
      setRolling(false);
    }, DICE_ROLL_MS);
    return () => {
      window.clearInterval(spin);
      window.clearTimeout(stop);
      setFace(value);
      setRolling(false);
    };
  }, [nonce ?? value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <DieFace face={face} look={useSkin("dice").dice} small={small} rolling={rolling} label={value ? `Die showing ${value}` : "Die not rolled yet"} />;
}

const PIP_GLYPHS: Record<NonNullable<DiceLook["shape"]>, string> = {
  dot: "",
  heart: "♥",
  star: "★",
  skull: "☠",
  paw: "🐾",
  flame: "🔥",
  diamond: "◆",
  flower: "✿",
  snow: "❄",
  moon: "☾",
};

// One die face in a dice skin (no `look` = the Gemini 3D dice pictures).
export function DieFace({ face, look, small, rolling, label }: { face: number | null; look?: DiceLook; small?: boolean; rolling?: boolean; label?: string }) {
  const dots = face ? DIE_DOTS[face] : [];
  const state = `${small ? "die--small" : ""} ${rolling ? "is-rolling" : face ? "is-landed" : ""}`;
  const art = look ? undefined : skinArt(`die-${face ?? 1}.webp`);
  if (art) {
    return (
      <div className={`die die--art ${state} ${face ? "" : "is-blank"}`} aria-label={label}>
        <img src={art} alt="" draggable={false} />
      </div>
    );
  }
  const glyph = look?.shape && look.shape !== "dot" ? PIP_GLYPHS[look.shape] : null;
  return (
    <div
      className={`die ${look ? "die--skin" : ""} ${glyph ? "die--glyph" : ""} ${state}`}
      style={look ? { background: look.face, ["--pip" as string]: look.pip, ["--edge" as string]: look.edge ?? "rgba(255,255,255,.4)", ["--glow" as string]: look.glow ?? "transparent" } : undefined}
      aria-label={label}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`die-dot ${dots.includes(index) ? "is-on" : ""}`}>
          {glyph && dots.includes(index) ? glyph : null}
        </span>
      ))}
    </div>
  );
}

// Game logs are stored as "playerId|text" (and "@[playerId]" inside the text)
// so each client shows its own names.
const COLOR_WORD = /\b(red|yellow|green|blue)\b/gi;

function LogText({ log, names }: { log: string; names: Record<string, string> }) {
  const withNames = (text: string) => text.replace(/@\[([^\]]+)\]/g, (_, id: string) => names[id] ?? "someone");
  const tint = (text: string) =>
    text.split(COLOR_WORD).map((part, i) => (i % 2 ? <b key={i} className={`log-color log-color--${part.toLowerCase()}`}>{part}</b> : part));
  const split = log.indexOf("|");
  if (split < 0) return <>{tint(withNames(log))}</>;
  const who = log.slice(0, split);
  return (
    <>
      <strong>{names[who] ?? "Someone"}</strong> {tint(withNames(log.slice(split + 1)))}
    </>
  );
}

export function LogLine({ log, names }: { log: string; names: Record<string, string> }) {
  // Remember the last two lines before this one (per mounted game).
  const history = useRef<string[]>([]);
  const last = useRef(log);
  if (last.current !== log) {
    history.current = [last.current, ...history.current].slice(0, 2);
    last.current = log;
  }
  return (
    <div className="game-log-stack">
      {[...history.current].reverse().map((line, i) => (
        <p key={`${line}-${i}`} className="game-log game-log--old">
          <LogText log={line} names={names} />
        </p>
      ))}
      <p key={log} className="game-log">
        <LogText log={log} names={names} />
      </p>
    </div>
  );
}

type Next = (key: string, shown: number, target: number, all: { shown: Record<string, number>; targets: Record<string, number> }) => number;

// Walks displayed positions toward their real (already applied) values one
// square at a time, so moves read as hops instead of teleports.
export function useStepper(targets: Record<string, number>, next: Next, { delay = DICE_ROLL_MS, interval = 170 } = {}) {
  const [shown, setShown] = useState(targets);
  const nextRef = useRef(next);
  nextRef.current = next;
  const moving = useRef(false);
  const targetsKey = JSON.stringify(targets);

  useEffect(() => {
    const t: Record<string, number> = JSON.parse(targetsKey);
    const pending = Object.keys(t).some((k) => shown[k] !== t[k]);
    if (!pending) {
      moving.current = false;
      return;
    }
    const wait = moving.current ? interval : delay;
    const timer = window.setTimeout(() => {
      moving.current = true;
      const out: Record<string, number> = {};
      for (const k of Object.keys(t)) {
        out[k] = shown[k] === undefined || shown[k] === t[k] ? t[k] : nextRef.current(k, shown[k], t[k], { shown, targets: t });
      }
      setShown(out);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [targetsKey, shown, delay, interval]);

  const display: Record<string, number> = {};
  for (const k of Object.keys(targets)) display[k] = shown[k] ?? targets[k];
  const busy = Object.keys(targets).some((k) => display[k] !== targets[k]);
  return { shown: display, busy };
}

const CONFETTI_COLORS = ["#ec4899", "#8b5cf6", "#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#fde047"];

export function Confetti({ burst = 160, duration = 3200 }: { burst?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const w = canvas.width;
    const h = canvas.height;
    const parts = Array.from({ length: burst }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) + (Math.random() - 0.5) * 0.9;
      const speed = (9 + Math.random() * 10) * dpr;
      return {
        x: fromLeft ? 0 : w,
        y: h * 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (5 + Math.random() * 6) * dpr,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() < 0.3,
      };
    });
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, Math.min(1, (duration - t) / 600));
      for (const p of parts) {
        p.vy += 0.32 * dpr;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burst, duration]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

// Runs `effect` when `value` changes after the first render (for sounds).
export function useOnChange<T>(value: T, effect: (prev: T, next: T) => void) {
  const prev = useRef(value);
  const effectRef = useRef(effect);
  effectRef.current = effect;
  useEffect(() => {
    if (prev.current !== value) effectRef.current(prev.current, value);
    prev.current = value;
  }, [value]);
}

// Player strip with turn highlight, shared by the board games.
export function PlayerChips({
  players,
  current,
  names,
  color,
  detail,
}: {
  players: string[];
  current: string | null;
  names: Record<string, string>;
  color: (player: string, index: number) => string;
  detail?: (player: string, index: number) => string;
}) {
  return (
    <div className="players-strip">
      {players.map((player, index) => (
        <span key={player} className={`player-chip ${player === current ? "is-turn" : ""}`}>
          <i style={{ background: color(player, index) }}>{(names[player] ?? "?").slice(0, 1).toUpperCase()}</i>
          <span>
            <b>{names[player]}</b>
            {detail && <small>{detail(player, index)}</small>}
          </span>
        </span>
      ))}
    </div>
  );
}
