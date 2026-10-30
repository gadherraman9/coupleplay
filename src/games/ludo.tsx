import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameDef, GameViewProps } from "./types";
import { skinArt, useSkin } from "../skins";
import { rollDie } from "./types";
import { haptic, play } from "./sfx";
import { Dice, LogLine, PlayerChips, useStepper } from "./ui";

// The 52-square loop, clockwise from red's start square, as [row, col].
const TRACK: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0],
];

const COLORS = [
  { name: "Red", hex: "#ef4444", start: 0, home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], yard: [0, 0] },
  { name: "Green", hex: "#22c55e", start: 13, home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], yard: [0, 9] },
  { name: "Yellow", hex: "#eab308", start: 26, home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], yard: [9, 9] },
  { name: "Blue", hex: "#3b82f6", start: 39, home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], yard: [9, 0] },
] as const;

const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const FINISH = 56;
const SEATS: Record<number, number[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

interface State {
  players: string[];
  seats: number[];
  tokens: Record<string, number[]>;
  turn: number;
  dice: number | null;
  rollNo?: number;
  phase: "roll" | "move";
  // The last capture: who hit, with which token (drives the battle scene).
  capture?: { by: string; token: number; n: number };
  log: string;
  winner: string | null;
}

type Action = { type: "roll" } | { type: "move"; token: number };

function absolute(seat: number, progress: number) {
  return (COLORS[seat].start + progress) % 52;
}

function canMove(pos: number, dice: number) {
  if (pos === FINISH) return false;
  if (pos === -1) return dice === 6;
  return pos + dice <= FINISH;
}

function movable(state: State, player: string) {
  if (state.dice === null) return [];
  return state.tokens[player].map((pos, i) => (canMove(pos, state.dice!) ? i : -1)).filter((i) => i >= 0);
}

function nextTurn(state: State) {
  return (state.turn + 1) % state.players.length;
}

function cellOf(seat: number, pos: number, token: number): [number, number] {
  if (pos === -1) {
    const [r, c] = COLORS[seat].yard;
    const spots = [[1.9, 1.9], [1.9, 4.1], [4.1, 1.9], [4.1, 4.1]];
    return [r + spots[token][0] - 0.5, c + spots[token][1] - 0.5];
  }
  if (pos === FINISH) {
    const offsets = [[7, 6.4], [6.4, 7], [7, 7.6], [7.6, 7]];
    return offsets[seat] as [number, number];
  }
  if (pos > 50) return COLORS[seat].home[pos - 51] as unknown as [number, number];
  return TRACK[absolute(seat, pos)];
}

const PAWN = ["pawn-red.webp", "pawn-green.webp", "pawn-yellow.webp", "pawn-blue.webp"];
const SOLDIER = ["soldier-red.webp", "soldier-green.webp", "soldier-yellow.webp", "soldier-blue.webp"];
const FIGHT_MS = { aim: 350, hit: 750, fall: 1500 };

interface Fight {
  victim: string;
  attacker: string;
  weapon: "gun" | "axe";
  stage: "aim" | "hit" | "fall" | "fly";
}

function LudoView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const skin = useSkin("ludo");
  const battle = skin.pieces === "soldier";
  const boardArt = skinArt(skin.board);
  const current = state.players[state.turn];
  const targets: Record<string, number> = {};
  state.players.forEach((player) => state.tokens[player].forEach((pos, t) => (targets[`${player}:${t}`] = pos)));
  const [fight, setFight] = useState<Fight | null>(null);
  const fightRef = useRef<Fight | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Battle skin: the attacker shoots (or swings an axe), the victim falls,
  // then marches back to base. The stepper waits until the scene is done.
  const startFight = (victim: string) => {
    const capture = state.capture;
    const attacker = capture ? `${capture.by}:${capture.token}` : "";
    const next: Fight = { victim, attacker, weapon: (capture?.n ?? 0) % 2 === 1 ? "gun" : "axe", stage: "aim" };
    fightRef.current = next;
    setFight(next);
    const stage = (name: Fight["stage"], at: number, sound?: () => void) =>
      timers.current.push(
        window.setTimeout(() => {
          if (fightRef.current?.victim !== victim) return;
          fightRef.current = { ...fightRef.current, stage: name };
          setFight(fightRef.current);
          sound?.();
        }, at),
      );
    stage("hit", FIGHT_MS.aim, () => {
      play(next.weapon === "gun" ? "gunshot" : "axe");
      haptic(60);
    });
    stage("fall", FIGHT_MS.hit, () => play("fall"));
    stage("fly", FIGHT_MS.fall, () => play("march"));
    timers.current.push(
      window.setTimeout(() => {
        if (fightRef.current?.victim === victim) {
          fightRef.current = null;
          setFight(null);
        }
      }, FIGHT_MS.fall + 1100),
    );
  };

  const { shown, busy } = useStepper(targets, (key, at, target, all) => {
    if (target === -1) {
      const othersMoving = Object.keys(all.targets).some((k) => all.targets[k] !== -1 && all.shown[k] !== all.targets[k]);
      if (othersMoving) return at;
      if (battle) {
        const f = fightRef.current;
        if (!f || f.victim !== key) {
          if (!f) startFight(key);
          return at;
        }
        if (f.stage !== "fly") return at;
        return -1;
      }
      play("capture");
      haptic(40);
      return -1;
    }
    if (at === -1 || at < target) {
      const next = at === -1 ? 0 : at + 1;
      play(next === FINISH ? "home" : "step");
      return next;
    }
    return target;
  });
  const myTurn = current === me && !finished && !busy;
  const options = myTurn && state.phase === "move" ? movable(state, me) : [];
  const cellType = new Map<string, string>();
  TRACK.forEach(([r, c], i) => {
    const startSeat = COLORS.findIndex((color) => color.start === i);
    cellType.set(`${r},${c}`, startSeat >= 0 ? `start-${startSeat}` : SAFE.has(i) ? "star" : "track");
  });
  COLORS.forEach((color, seat) => color.home.forEach(([r, c]) => cellType.set(`${r},${c}`, `home-${seat}`)));

  // Tokens sharing a square sit side by side.
  const placed = state.players.flatMap((player, p) => {
    const seat = state.seats[p];
    return state.tokens[player].map((_, t) => {
      const pos = shown[`${player}:${t}`];
      return { player, seat, t, pos, cell: cellOf(seat, pos, t) };
    });
  });
  const stacks = new Map<string, number>();
  const stackIndex = placed.map(({ cell, pos }) => {
    if (pos === -1) return { i: 0, n: 1 };
    const key = cell.join(",");
    const i = stacks.get(key) ?? 0;
    stacks.set(key, i + 1);
    return { i, n: 0, key };
  });

  const boardStyle: CSSProperties | undefined = boardArt ? { backgroundImage: `url(${boardArt})`, backgroundColor: skin.tint } : skin.tint ? { backgroundColor: skin.tint } : undefined;
  const fightCell = fight ? placed.find((p) => `${p.player}:${p.t}` === fight.victim)?.cell : undefined;

  return (
    <div className="board-game">
      <div className={`ludo-board ludo-skin--${skin.id} ${boardArt ? "has-art" : ""}`} style={boardStyle}>
        {Array.from({ length: 225 }, (_, i) => {
          const r = Math.floor(i / 15);
          const c = i % 15;
          const type = cellType.get(`${r},${c}`);
          if (!type) return <span key={i} className="ludo-cell ludo-cell--empty" />;
          const [kind, seat] = type.split("-");
          return (
            <span
              key={i}
              className={`ludo-cell ludo-cell--${kind}`}
              style={seat !== undefined ? { background: COLORS[Number(seat)].hex } : undefined}
            >
              {kind === "star" ? "★" : kind === "start" ? <i className="ludo-arrow" style={{ transform: `rotate(${Number(seat) * 90}deg)` }}>➤</i> : ""}
            </span>
          );
        })}
        {COLORS.map((color, seat) => (
          <span
            key={color.name}
            className={`ludo-yard ${state.seats.includes(seat) ? "" : "is-empty"} ${state.seats[state.turn] === seat && !finished ? "is-turn" : ""}`}
            style={{ top: `${(color.yard[0] / 15) * 100}%`, left: `${(color.yard[1] / 15) * 100}%`, background: boardArt ? `${color.hex}8c` : color.hex }}
          >
            <span className="ludo-yard-inner">
              {[0, 1, 2, 3].map((spot) => (
                <i key={spot} style={{ background: color.hex }} />
              ))}
            </span>
          </span>
        ))}
        <svg className="ludo-center" viewBox="0 0 2 2" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="0,0 2,0 1,1" fill={COLORS[1].hex} />
          <polygon points="2,0 2,2 1,1" fill={COLORS[2].hex} />
          <polygon points="2,2 0,2 1,1" fill={COLORS[3].hex} />
          <polygon points="0,2 0,0 1,1" fill={COLORS[0].hex} />
          <circle cx="1" cy="1" r="0.28" fill="#fff" opacity="0.9" />
          <text x="1" y="1.11" textAnchor="middle" fontSize="0.32">🏠</text>
        </svg>
        {placed.map(({ player, seat, t, pos, cell }, idx) => {
          const [r, c] = cell;
          const clickable = player === me && options.includes(t);
          const stack = stackIndex[idx];
          const count = stack.key ? stacks.get(stack.key)! : 1;
          const key = `${player}:${t}`;
          const role = fight?.victim === key ? "victim" : fight?.attacker === key ? "attacker" : null;
          const shift = role === "victim" ? 1.5 : role === "attacker" ? -1.5 : count > 1 ? (stack.i - (count - 1) / 2) * 1.6 : 0;
          const sprite = skinArt(battle ? SOLDIER[seat] : PAWN[seat]);
          return (
            <button
              key={`${player}-${t}`}
              type="button"
              className={`ludo-token ${clickable ? "is-movable" : ""} ${count > 1 && !role ? "is-stacked" : ""} ${battle ? "is-soldier" : sprite ? "is-pawn-art" : ""} ${role ? `is-${role} stage-${fight!.stage} weapon-${fight!.weapon}` : ""}`}
              style={{
                top: `${((r + 0.5) / 15) * 100}%`,
                left: `${((c + 0.5) / 15) * 100 + shift}%`,
                ["--pawn" as string]: COLORS[seat].hex,
                zIndex: role ? 40 : pos === -1 ? 2 : 4 + r,
              }}
              disabled={!clickable}
              onClick={() => act({ type: "move", token: t })}
              aria-label={`${COLORS[seat].name} ${battle ? "soldier" : "token"} ${t + 1}`}
            >
              {battle || sprite ? (
                <span key={pos} className="ludo-soldier">
                  {sprite ? <img src={sprite} alt="" draggable={false} /> : <span className="ludo-token-hop" />}
                </span>
              ) : (
                <span key={pos} className="ludo-token-hop" />
              )}
            </button>
          );
        })}
        {fight && fightCell && fight.stage !== "fly" && (
          <span
            className={`ludo-fx weapon-${fight.weapon} stage-${fight.stage}`}
            style={{ top: `${((fightCell[0] + 0.5) / 15) * 100}%`, left: `${((fightCell[1] + 0.5) / 15) * 100}%` }}
            aria-hidden="true"
          >
            {fight.weapon === "gun" ? (
              <>
                {skinArt("muzzle-flash.webp") ? <img className="fx-flash" src={skinArt("muzzle-flash.webp")} alt="" /> : <i className="fx-flash fx-flash--css" />}
                <i className="fx-bullet" />
              </>
            ) : skinArt("axe.webp") ? (
              <img className="fx-axe" src={skinArt("axe.webp")} alt="" />
            ) : (
              <i className="fx-axe fx-axe--css">🪓</i>
            )}
            <i className="fx-hit" />
          </span>
        )}
      </div>

      <PlayerChips
        players={state.players}
        current={current}
        names={names}
        color={(_, p) => COLORS[state.seats[p]].hex}
        detail={(player) => `${state.tokens[player].filter((pos) => pos === FINISH).length}/4 home`}
      />

      <LogLine log={state.log} names={names} />
      <div className="board-actions">
        <Dice value={state.dice} nonce={state.rollNo ?? state.log} />
        <button
          type="button"
          className={`primary-btn ${myTurn && state.phase === "roll" ? "is-ready" : ""}`}
          disabled={!myTurn || state.phase !== "roll"}
          onClick={() => act({ type: "roll" })}
        >
          {finished
            ? "Game over"
            : busy
              ? "Moving…"
              : !myTurn
                ? `${names[current]}'s turn`
                : state.phase === "roll"
                  ? "Roll the dice"
                  : "Tap a glowing token"}
        </button>
      </div>
    </div>
  );
}

export const ludoGame: GameDef<State, Action> = {
  id: "ludo",
  title: "Ludo",
  tagline: "Roll a six, race your four tokens home.",
  emoji: "🎲",
  className: "game-card--ludo",
  minPlayers: 2,
  maxPlayers: 4,
  botDelay: 1500,
  init: (players) => ({
    players,
    seats: SEATS[players.length] ?? SEATS[4],
    tokens: Object.fromEntries(players.map((p) => [p, [-1, -1, -1, -1]])),
    turn: 0,
    dice: null,
    phase: "roll",
    log: "Roll a 6 to bring a token out.",
    winner: null,
  }),
  apply: (state, action, by) => {
    if (state.winner || state.players[state.turn] !== by) return state;
    if (action.type === "roll") {
      if (state.phase !== "roll") return state;
      const dice = rollDie();
      const next = { ...state, dice, rollNo: (state.rollNo ?? 0) + 1 };
      if (movable(next, by).length === 0) {
        return { ...next, phase: "roll", turn: nextTurn(state), log: `${by}|rolled ${dice} — no moves` };
      }
      return { ...next, phase: "move", log: `${by}|rolled ${dice}` };
    }
    if (state.phase !== "move" || state.dice === null) return state;
    const dice = state.dice;
    const seat = state.seats[state.players.indexOf(by)];
    const mine = [...state.tokens[by]];
    const from = mine[action.token];
    if (!canMove(from, dice)) return state;
    const to = from === -1 ? 0 : from + dice;
    mine[action.token] = to;
    const tokens = { ...state.tokens, [by]: mine };
    let captured = false;
    if (to <= 50) {
      const square = absolute(seat, to);
      if (!SAFE.has(square)) {
        state.players.forEach((other, p) => {
          if (other === by) return;
          const otherSeat = state.seats[p];
          const theirs = tokens[other].map((pos) => {
            if (pos >= 0 && pos <= 50 && absolute(otherSeat, pos) === square) {
              captured = true;
              return -1;
            }
            return pos;
          });
          tokens[other] = theirs;
        });
      }
    }
    const won = mine.every((pos) => pos === FINISH);
    const bonus = dice === 6 || captured || to === FINISH;
    let log = from === -1 ? "brought a token out" : `moved ${dice}`;
    if (captured) log += " and captured a token! 💥";
    const capture = captured ? { by, token: action.token, n: (state.capture?.n ?? 0) + 1 } : state.capture;
    if (to === FINISH) log += " — a token reached home 🏠";
    return {
      ...state,
      tokens,
      capture,
      phase: "roll",
      dice,
      turn: won || bonus ? state.turn : nextTurn(state),
      log: `${by}|${log}${bonus && !won ? " (extra roll)" : ""}`,
      winner: won ? by : null,
    };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botMove: (state, bot) => {
    if (state.phase === "roll") return { type: "roll" };
    const options = movable(state, bot);
    if (options.length === 0) return null;
    const seat = state.seats[state.players.indexOf(bot)];
    const score = (t: number) => {
      const from = state.tokens[bot][t];
      const to = from === -1 ? 0 : from + state.dice!;
      if (to === FINISH) return 100;
      if (to <= 50) {
        const square = absolute(seat, to);
        const hits = state.players.some((other, p) =>
          other !== bot &&
          state.tokens[other].some((pos) => pos >= 0 && pos <= 50 && absolute(state.seats[p], pos) === square),
        );
        if (hits && !SAFE.has(square)) return 90;
      }
      if (from === -1) return 70;
      return to;
    };
    return { type: "move", token: options.sort((a, b) => score(b) - score(a))[0] };
  },
  View: LudoView,
};
