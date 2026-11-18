import type { GameDef, GameViewProps } from "./types";
import { rollDie } from "./types";
import { play } from "./sfx";
import { Dice, LogLine, PlayerChips, useOnChange, useStepper } from "./ui";

type Square =
  | { kind: "go" | "jail" | "gotojail" | "chance"; name: string }
  | { kind: "tax"; name: string; amount: number }
  | { kind: "city"; name: string; price: number; rent: number; group: string }
  | { kind: "station"; name: string; price: number };

const GROUP_COLORS: Record<string, string> = { a: "#a16207", b: "#0ea5e9", c: "#ec4899", d: "#16a34a" };

const BOARD: Square[] = [
  { kind: "go", name: "START" },
  { kind: "city", name: "Jaipur", price: 60, rent: 6, group: "a" },
  { kind: "chance", name: "Chance" },
  { kind: "city", name: "Udaipur", price: 70, rent: 7, group: "a" },
  { kind: "tax", name: "Tax", amount: 100 },
  { kind: "station", name: "Railway", price: 150 },
  { kind: "city", name: "Pune", price: 100, rent: 10, group: "b" },
  { kind: "city", name: "Goa", price: 110, rent: 11, group: "b" },
  { kind: "chance", name: "Chance" },
  { kind: "city", name: "Kochi", price: 120, rent: 12, group: "b" },
  { kind: "jail", name: "Jail" },
  { kind: "city", name: "Hyderabad", price: 140, rent: 14, group: "c" },
  { kind: "city", name: "Kolkata", price: 150, rent: 15, group: "c" },
  { kind: "chance", name: "Chance" },
  { kind: "city", name: "Chennai", price: 160, rent: 16, group: "c" },
  { kind: "station", name: "Airport", price: 150 },
  { kind: "city", name: "Bengaluru", price: 200, rent: 20, group: "d" },
  { kind: "city", name: "Delhi", price: 220, rent: 22, group: "d" },
  { kind: "gotojail", name: "Go to Jail" },
  { kind: "city", name: "Mumbai", price: 260, rent: 26, group: "d" },
];

const CHANCE: { text: string; money?: number; move?: number; jail?: boolean }[] = [
  { text: "won a dance contest (+₹100)", money: 100 },
  { text: "got a birthday gift (+₹50)", money: 50 },
  { text: "paid a speeding fine (−₹50)", money: -50 },
  { text: "won the lottery (+₹150)", money: 150 },
  { text: "paid a hospital bill (−₹100)", money: -100 },
  { text: "moved back 3 squares", move: -3 },
  { text: "was caught cheating at cards — go to jail!", jail: true },
  { text: "found ₹20 in an old jacket", money: 20 },
];

const LEVEL_MULT = [1, 4, 8, 14];
const MAX_ROUNDS = 25;
const PLAYER_COLORS = ["#ec4899", "#3b82f6", "#22c55e", "#f59e0b"];

interface Property {
  owner: string;
  level: number;
}

interface State {
  players: string[];
  money: Record<string, number>;
  position: Record<string, number>;
  jailed: Record<string, boolean>;
  bankrupt: string[];
  props: Record<number, Property>;
  turn: number;
  round: number;
  dice: [number, number] | null;
  phase: "roll" | "buy" | "end";
  log: string;
  winner: string | null;
}

type Action = { type: "roll" } | { type: "buy" } | { type: "skip" } | { type: "upgrade"; square: number } | { type: "end" };

function ownsGroup(state: State, player: string, group: string) {
  return BOARD.every((sq, i) => sq.kind !== "city" || sq.group !== group || state.props[i]?.owner === player);
}

function rentFor(state: State, index: number) {
  const square = BOARD[index];
  const prop = state.props[index];
  if (!prop) return 0;
  if (square.kind === "station") {
    const count = BOARD.filter((sq, i) => sq.kind === "station" && state.props[i]?.owner === prop.owner).length;
    return count * 25;
  }
  if (square.kind !== "city") return 0;
  if (prop.level === 0 && ownsGroup(state, prop.owner, square.group)) return square.rent * 2;
  return square.rent * LEVEL_MULT[prop.level];
}

function netWorth(state: State, player: string) {
  let total = state.money[player];
  for (const [key, prop] of Object.entries(state.props)) {
    const square = BOARD[Number(key)];
    if (prop.owner === player && (square.kind === "city" || square.kind === "station")) {
      total += square.price + (square.kind === "city" ? prop.level * Math.round(square.price / 2) : 0);
    }
  }
  return total;
}

function canUpgrade(state: State, player: string, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD.length) return false;
  const square = BOARD[index];
  const prop = state.props[index];
  return (
    square.kind === "city" &&
    prop?.owner === player &&
    prop.level < 3 &&
    ownsGroup(state, player, square.group) &&
    state.money[player] >= Math.round(square.price / 2)
  );
}

function advanceTurn(state: State): State {
  const active = state.players.filter((p) => !state.bankrupt.includes(p));
  if (active.length <= 1) return { ...state, winner: active[0] ?? null };
  let turn = state.turn;
  let round = state.round;
  do {
    turn = (turn + 1) % state.players.length;
    if (turn === 0) round += 1;
  } while (state.bankrupt.includes(state.players[turn]));
  if (round > MAX_ROUNDS) {
    const richest = [...active].sort((a, b) => netWorth(state, b) - netWorth(state, a))[0];
    return { ...state, winner: richest, log: `${richest}|is the richest after ${MAX_ROUNDS} rounds and wins! 🏆` };
  }
  return { ...state, turn, round, phase: "roll", dice: null };
}

function pay(state: State, from: string, amount: number, to?: string): State {
  const money = { ...state.money, [from]: state.money[from] - amount };
  if (to) money[to] += amount;
  let next: State = { ...state, money };
  if (money[from] < 0) {
    const props = { ...state.props };
    for (const key of Object.keys(props)) if (props[Number(key)].owner === from) delete props[Number(key)];
    next = { ...next, props, bankrupt: [...state.bankrupt, from], log: `${from}|went bankrupt 💸` };
  }
  return next;
}

function gridPos(index: number) {
  if (index <= 5) return { row: 5, col: 5 - index };
  if (index <= 10) return { row: 5 - (index - 5), col: 0 };
  if (index <= 15) return { row: 0, col: index - 10 };
  return { row: index - 15, col: 5 };
}

function TycoonView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const current = state.players[state.turn];
  const myTurn = current === me && !finished;
  const here = BOARD[state.position[current]];
  const { shown, busy } = useStepper(state.position, (player, at, target) => {
    const dist = (target - at + BOARD.length) % BOARD.length;
    if (dist > 0 && dist <= 12 && !state.jailed[player]) {
      play("step");
      return (at + 1) % BOARD.length;
    }
    play("slide");
    return target;
  });
  const owned = Object.keys(state.props).length;
  useOnChange(owned, (prev, next) => next > prev && play("coin"));
  const ready = myTurn && !busy;

  return (
    <div className="board-game">
      <div className="tycoon-board">
        {BOARD.map((square, index) => {
          const { row, col } = gridPos(index);
          const prop = state.props[index];
          const ownerSeat = prop ? state.players.indexOf(prop.owner) : -1;
          const upgradable = myTurn && state.phase === "end" && canUpgrade(state, me, index);
          return (
            <button
              key={index}
              type="button"
              className={`ty-square ty-square--${square.kind} ${upgradable ? "is-upgradable" : ""}`}
              style={{ gridRow: row + 1, gridColumn: col + 1, outlineColor: ownerSeat >= 0 ? PLAYER_COLORS[ownerSeat] : undefined }}
              disabled={!upgradable}
              onClick={() => act({ type: "upgrade", square: index })}
              title={upgradable ? "Tap to build a house" : square.name}
            >
              {square.kind === "city" && <i style={{ background: GROUP_COLORS[square.group] }} />}
              <b>{square.name}</b>
              {(square.kind === "city" || square.kind === "station") && (
                <small>{prop ? `${"🏠".repeat(prop.level)}₹${rentFor(state, index)}` : `₹${square.price}`}</small>
              )}
              {square.kind === "tax" && <small>₹{square.amount}</small>}
              {ownerSeat >= 0 && <span className="ty-owner" style={{ background: PLAYER_COLORS[ownerSeat] }} />}
              <span className="ty-tokens">
                {state.players.map((player, seat) =>
                  shown[player] === index && !state.bankrupt.includes(player) ? (
                    <span key={player} className="ty-token" style={{ background: PLAYER_COLORS[seat] }} />
                  ) : null,
                )}
              </span>
            </button>
          );
        })}
        <div className="ty-center">
          <div className="ty-dice">
            <Dice value={state.dice?.[0] ?? null} small nonce={state.log} />
            <Dice value={state.dice?.[1] ?? null} small nonce={state.log} />
          </div>
          <LogLine log={state.log} names={names} />
          <small className="ty-round">Round {Math.min(state.round, MAX_ROUNDS)} / {MAX_ROUNDS}</small>
        </div>
      </div>

      <PlayerChips
        players={state.players}
        current={current}
        names={names}
        color={(_, seat) => PLAYER_COLORS[seat]}
        detail={(player) => (state.bankrupt.includes(player) ? "bankrupt" : `₹${state.money[player]}`)}
      />

      <div className="board-actions board-actions--wrap">
        {!ready && <p className="turn-label">{finished ? "Game over" : busy ? "Moving…" : `${names[current]}'s turn`}</p>}
        {ready && state.phase === "roll" && (
          <button type="button" className="primary-btn" onClick={() => act({ type: "roll" })}>
            {state.jailed[me] ? "Serve jail time" : "Roll the dice"}
          </button>
        )}
        {ready && state.phase === "buy" && (here.kind === "city" || here.kind === "station") && (
          <>
            <button type="button" className="primary-btn" disabled={state.money[me] < here.price} onClick={() => act({ type: "buy" })}>
              Buy {here.name} for ₹{here.price}
            </button>
            <button type="button" className="ghost-btn" onClick={() => act({ type: "skip" })}>
              Skip
            </button>
          </>
        )}
        {ready && state.phase === "end" && (
          <>
            <p className="turn-label">Tap your glowing cities to build houses</p>
            <button type="button" className="primary-btn" onClick={() => act({ type: "end" })}>
              End turn
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export const tycoonGame: GameDef<State, Action> = {
  id: "tycoon",
  title: "Business Tycoon",
  tagline: "Buy Indian cities, build houses, collect rent.",
  emoji: "🏙️",
  className: "game-card--tycoon",
  minPlayers: 2,
  maxPlayers: 4,
  init: (players) => ({
    players,
    money: Object.fromEntries(players.map((p) => [p, 1500])),
    position: Object.fromEntries(players.map((p) => [p, 0])),
    jailed: {},
    bankrupt: [],
    props: {},
    turn: 0,
    round: 1,
    dice: null,
    phase: "roll",
    log: "Everyone starts with ₹1500. Pass START to collect ₹200.",
    winner: null,
  }),
  apply: (state, action, by) => {
    if (state.winner || state.players[state.turn] !== by) return state;

    if (action.type === "roll" && state.phase === "roll") {
      if (state.jailed[by]) {
        return advanceTurn({ ...state, jailed: { ...state.jailed, [by]: false }, log: `${by}|spent a turn in jail 🔒` });
      }
      const dice: [number, number] = [rollDie(), rollDie()];
      let pos = state.position[by] + dice[0] + dice[1];
      let next: State = { ...state, dice };
      let log = `rolled ${dice[0] + dice[1]}`;
      if (pos >= BOARD.length) {
        pos -= BOARD.length;
        next = { ...next, money: { ...next.money, [by]: next.money[by] + 200 } };
        log += ", passed START (+₹200)";
      }
      const square = BOARD[pos];
      next = { ...next, position: { ...next.position, [by]: pos }, phase: "end" };

      if (square.kind === "chance") {
        const card = CHANCE[Math.floor(Math.random() * CHANCE.length)];
        log += ` — Chance: ${card.text}`;
        if (card.money) next = pay(next, by, -card.money);
        if (card.move) next = { ...next, position: { ...next.position, [by]: (pos + card.move + BOARD.length) % BOARD.length } };
        if (card.jail) next = { ...next, position: { ...next.position, [by]: 10 }, jailed: { ...next.jailed, [by]: true } };
      } else if (square.kind === "tax") {
        log += ` — paid ₹${square.amount} tax`;
        next = pay(next, by, square.amount);
      } else if (square.kind === "gotojail") {
        log += " — off to jail! 🚓";
        next = { ...next, position: { ...next.position, [by]: 10 }, jailed: { ...next.jailed, [by]: true } };
      } else if (square.kind === "city" || square.kind === "station") {
        const prop = next.props[pos];
        if (!prop) {
          log += ` — landed on ${square.name}`;
          next = { ...next, phase: "buy" };
        } else if (prop.owner !== by) {
          const rent = rentFor(next, pos);
          log += ` — paid ₹${rent} rent to @[${prop.owner}]`;
          next = pay(next, by, rent, prop.owner);
        } else {
          log += ` — home sweet ${square.name}`;
        }
      }
      if (next.bankrupt.includes(by)) return advanceTurn(next);
      return { ...next, log: `${by}|${log}` };
    }

    if (action.type === "buy" && state.phase === "buy") {
      const pos = state.position[by];
      const square = BOARD[pos];
      if ((square.kind !== "city" && square.kind !== "station") || state.money[by] < square.price) return state;
      return {
        ...state,
        money: { ...state.money, [by]: state.money[by] - square.price },
        props: { ...state.props, [pos]: { owner: by, level: 0 } },
        phase: "end",
        log: `${by}|bought ${square.name} 🏷️`,
      };
    }

    if (action.type === "skip" && state.phase === "buy") return { ...state, phase: "end" };

    if (action.type === "upgrade" && state.phase === "end" && canUpgrade(state, by, action.square)) {
      const square = BOARD[action.square] as Extract<Square, { kind: "city" }>;
      const prop = state.props[action.square];
      return {
        ...state,
        money: { ...state.money, [by]: state.money[by] - Math.round(square.price / 2) },
        props: { ...state.props, [action.square]: { ...prop, level: prop.level + 1 } },
        log: `${by}|built a house in ${square.name} 🏠`,
      };
    }

    if (action.type === "end" && state.phase === "end") return advanceTurn(state);
    return state;
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botDelay: 1600,
  botMove: (state, bot) => {
    if (state.phase === "roll") return { type: "roll" };
    if (state.phase === "buy") {
      const square = BOARD[state.position[bot]];
      if ((square.kind === "city" || square.kind === "station") && state.money[bot] - square.price > 150) return { type: "buy" };
      return { type: "skip" };
    }
    const upgrade = BOARD.findIndex((_, i) => canUpgrade(state, bot, i));
    if (upgrade >= 0 && state.money[bot] > 500) return { type: "upgrade", square: upgrade };
    return { type: "end" };
  },
  View: TycoonView,
};
