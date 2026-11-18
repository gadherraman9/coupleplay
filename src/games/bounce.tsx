import { useCallback, useEffect, useRef, useState } from "react";
import type { GameDef, GameViewProps } from "./types";
import { play } from "./sfx";

const CW = 340;
const CH = 470;
const GRAVITY = 0.32;
const JUMP = -9.6;
const BALL_R = 11;

interface Platform {
  x: number;
  y: number;
  w: number;
  vx: number;
  kind: "normal" | "spring" | "crumble";
  broken?: boolean;
}

interface Heart {
  x: number;
  y: number;
  taken?: boolean;
}

interface State {
  best: number;
  lastScore: number | null;
  plays: number;
  player: string;
}

type Action = { type: "over"; score: number };

function makePlatform(y: number, level: number): Platform {
  const roll = Math.random();
  const w = Math.max(46, 78 - level * 2);
  return {
    x: Math.random() * (CW - w),
    y,
    w,
    vx: roll < Math.min(0.35, 0.05 + level * 0.03) ? (Math.random() < 0.5 ? -1 : 1) * (1 + level * 0.12) : 0,
    kind: roll > 0.9 ? "spring" : roll > 0.78 && level > 1 ? "crumble" : "normal",
  };
}

function BounceView({ state, act, finished }: GameViewProps<State, Action>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const input = useRef({ left: false, right: false });
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState<number | null>(null);

  const start = useCallback(() => {
    setOver(null);
    setScore(0);
    setRunning(true);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") input.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") input.current.right = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") input.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") input.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const ball = { x: CW / 2, y: CH - 80, vx: 0, vy: JUMP };
    const platforms: Platform[] = [{ x: CW / 2 - 40, y: CH - 40, w: 80, vx: 0, kind: "normal" }];
    const hearts: Heart[] = [];
    for (let y = CH - 110; y > -40; y -= 62) platforms.push(makePlatform(y, 0));
    let height = 0;
    let collected = 0;
    let raf = 0;
    let t = 0;

    const draw = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, CH);
      const hue = 280 - Math.min(160, height / 60);
      sky.addColorStop(0, `hsl(${hue} 70% 22%)`);
      sky.addColorStop(1, `hsl(${hue + 30} 75% 55%)`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 24; i += 1) {
        const sx = (i * 73) % CW;
        const sy = (i * 131 + height * 0.2) % CH;
        ctx.fillRect(sx, sy, 2, 2);
      }
      for (const p of platforms) {
        if (p.broken) continue;
        ctx.fillStyle = p.kind === "spring" ? "#facc15" : p.kind === "crumble" ? "#a8a29e" : "#f472b6";
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, 10, 5);
        ctx.fill();
        if (p.kind === "spring") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(p.x + p.w / 2 - 6, p.y - 6, 12, 6);
        }
      }
      for (const h of hearts) {
        if (h.taken) continue;
        ctx.fillStyle = "#fb7185";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("❤", h.x, h.y + 6 + Math.sin(t / 10 + h.x) * 2);
      }
      const grad = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, BALL_R);
      grad.addColorStop(0, "#fff");
      grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Nunito, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.floor(height / 10) + collected * 25}`, 12, 24);
    };

    if (!running) {
      draw();
      return;
    }

    const tick = () => {
      t += 1;
      const level = Math.floor(height / 2500);
      const steer = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
      ball.vx = ball.vx * 0.86 + steer * 0.9;
      ball.vy += GRAVITY;
      ball.x += ball.vx;
      ball.y += ball.vy;
      if (ball.x < -BALL_R) ball.x = CW + BALL_R;
      if (ball.x > CW + BALL_R) ball.x = -BALL_R;

      for (const p of platforms) {
        if (p.vx) {
          p.x += p.vx;
          if (p.x < 0 || p.x + p.w > CW) p.vx = -p.vx;
        }
        if (
          !p.broken &&
          ball.vy > 0 &&
          ball.x > p.x - 4 &&
          ball.x < p.x + p.w + 4 &&
          ball.y + BALL_R > p.y &&
          ball.y + BALL_R < p.y + 12 + ball.vy
        ) {
          if (p.kind === "crumble") {
            p.broken = true;
            play("draw", 0.6);
          } else {
            ball.y = p.y - BALL_R;
            ball.vy = p.kind === "spring" ? JUMP * 1.6 : JUMP;
            play(p.kind === "spring" ? "climb" : "bounce", 0.5);
          }
        }
      }
      for (const h of hearts) {
        if (!h.taken && Math.abs(h.x - ball.x) < 18 && Math.abs(h.y - ball.y) < 18) {
          h.taken = true;
          collected += 1;
          play("coin", 0.7);
        }
      }

      if (ball.y < CH * 0.42) {
        const shift = CH * 0.42 - ball.y;
        ball.y += shift;
        height += shift;
        for (const p of platforms) p.y += shift;
        for (const h of hearts) h.y += shift;
      }
      while (platforms.length && platforms[0].y > CH + 20) platforms.shift();
      const top = Math.min(...platforms.map((p) => p.y));
      if (top > -10) {
        const gap = 58 + Math.min(40, level * 6) + Math.random() * 14;
        const p = makePlatform(top - gap, level);
        platforms.push(p);
        if (Math.random() < 0.18) hearts.push({ x: p.x + p.w / 2, y: p.y - 26 });
      }

      draw();
      const now = Math.floor(height / 10) + collected * 25;
      if (t % 6 === 0) setScore(now);
      if (ball.y - BALL_R > CH) {
        setRunning(false);
        setOver(now);
        play("lose");
        act({ type: "over", score: now });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, act]);

  const hold = (dir: "left" | "right", on: boolean) => {
    input.current[dir] = on;
  };

  return (
    <div className="board-game bounce-game">
      <div className="bounce-wrap">
        <canvas ref={canvasRef} width={CW} height={CH} className="bounce-canvas" />
        {!running && (
          <div className="bounce-overlay">
            {over !== null ? (
              <>
                <strong>Score {over}</strong>
                <span>{over >= state.best ? "New best! 🏆" : `Best ${state.best}`}</span>
              </>
            ) : (
              <>
                <strong>Bounce</strong>
                <span>Hop up the platforms. Yellow ones launch you, grey ones crumble. Grab hearts for +25.</span>
              </>
            )}
            {!finished && <button type="button" className="primary-btn" onClick={start}>Start</button>}
            {finished && <span>Open the result to start a new run.</span>}
          </div>
        )}
      </div>
      <div className="bounce-pad">
        {(["left", "right"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onPointerDown={() => hold(dir, true)}
            onPointerUp={() => hold(dir, false)}
            onPointerLeave={() => hold(dir, false)}
            onPointerCancel={() => hold(dir, false)}
            aria-label={`Move ${dir}`}
          >
            {dir === "left" ? "◀" : "▶"}
          </button>
        ))}
      </div>
      <p className="game-hint">
        Score {score} · Best {state.best} · Arrow keys or hold the buttons
      </p>
    </div>
  );
}

export const bounceGame: GameDef<State, Action> = {
  id: "bounce",
  title: "Bounce",
  tagline: "Hop the ball sky-high. Beat your best score.",
  emoji: "🔴",
  className: "game-card--bounce",
  minPlayers: 1,
  maxPlayers: 1,
  soloOnly: true,
  init: (players, host) => ({ best: host?.gameStats?.bounce?.bestScore ?? 0, lastScore: null, plays: 0, player: players[0] }),
  apply: (state, action, by) =>
    action.type === "over" && by === state.player && state.lastScore === null && Number.isFinite(action.score) && action.score >= 0
      ? { ...state, best: Math.max(state.best, action.score), lastScore: action.score, plays: state.plays + 1 }
      : state,
  winner: (state) => state.lastScore === null ? null : state.player,
  View: BounceView,
};
