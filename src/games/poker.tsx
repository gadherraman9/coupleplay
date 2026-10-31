import { useEffect, useRef, useState } from "react";
import type { GameDef, GameViewProps } from "./types";
import { CardBack, makeDeck, PlayingCard, seatOrder } from "./deck";
import type { PCard } from "./deck";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";
import { useCardFlights } from "./cardFly";
import { skinArt } from "../skins";

const CHIP_ART = ["chip-red.webp", "chip-blue.webp", "chip-gold.webp"].map((n) => skinArt(n));

// Texas Hold'em, no limit. Everyone starts with 1000 chips; blinds go up
// every 5 hands. The game ends when one player has every chip, or after
// MAX_HANDS hands (most chips wins).
const START_CHIPS = 1000;
const MAX_HANDS = 15;
const BLINDS: [number, number][] = [[10, 20], [20, 40], [40, 80], [75, 150]];
const RESULT_MS = 3600;

type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

interface Seat {
  chips: number;
  bet: number;
  total: number;
  folded: boolean;
  allIn: boolean;
  out: boolean;
  cards: PCard[];
}

interface Result {
  seat: number;
  amount: number;
  hand: string;
}

interface State {
  players: string[];
  seats: Seat[];
  deck: PCard[];
  board: PCard[];
  dealer: number;
  turn: number;
  street: Street;
  toAct: number[];
  currentBet: number;
  minRaise: number;
  hand: number;
  blinds: [number, number];
  results: Result[] | null;
  reveal: boolean;
  said: Record<number, string>;
  log: string;
  winner: string | null;
}

type Action =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; to: number }
  | { type: "next"; hand: number };

// ---------- hand ranking ----------

const HAND_NAMES = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];

function score5(cards: PCard[]) {
  const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const unique = [...new Set(ranks)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0];
    else if (unique[0] === 14 && unique[1] === 5) straightHigh = 5;
  }
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map(([r]) => r);
  let cat: number;
  let kick: number[];
  if (straightHigh && flush) [cat, kick] = [8, [straightHigh]];
  else if (groups[0][1] === 4) [cat, kick] = [7, byGroup];
  else if (groups[0][1] === 3 && groups[1][1] === 2) [cat, kick] = [6, byGroup];
  else if (flush) [cat, kick] = [5, ranks];
  else if (straightHigh) [cat, kick] = [4, [straightHigh]];
  else if (groups[0][1] === 3) [cat, kick] = [3, byGroup];
  else if (groups[0][1] === 2 && groups[1][1] === 2) [cat, kick] = [2, byGroup];
  else if (groups[0][1] === 2) [cat, kick] = [1, byGroup];
  else [cat, kick] = [0, ranks];
  let value = cat;
  for (let i = 0; i < 5; i += 1) value = value * 15 + (kick[i] ?? 0);
  return value;
}

export function bestHand(cards: PCard[]) {
  let best = -1;
  const n = cards.length;
  for (let a = 0; a < n; a += 1)
    for (let b = a + 1; b < n; b += 1)
      for (let c = b + 1; c < n; c += 1)
        for (let d = c + 1; d < n; d += 1)
          for (let e = d + 1; e < n; e += 1) {
            const v = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (v > best) best = v;
          }
  return best;
}

const handName = (value: number) => HAND_NAMES[Math.floor(value / 15 ** 5)];

// ---------- table helpers ----------

const inHand = (s: Seat) => !s.out && !s.folded;
const canAct = (s: Seat) => inHand(s) && !s.allIn;
const pot = (state: State) => state.seats.reduce((sum, s) => sum + s.total, 0);

function nextSeat(state: State, from: number, ok: (s: Seat, i: number) => boolean) {
  const n = state.seats.length;
  for (let k = 1; k <= n; k += 1) {
    const i = (from + k) % n;
    if (ok(state.seats[i], i)) return i;
  }
  return -1;
}

function putIn(seat: Seat, amount: number) {
  const paid = Math.min(amount, seat.chips);
  seat.chips -= paid;
  seat.bet += paid;
  seat.total += paid;
  if (seat.chips === 0) seat.allIn = true;
  return paid;
}

function startHand(prev: State, first = false): State {
  const state: State = structuredClone(prev);
  state.hand = first ? 1 : prev.hand + 1;
  state.blinds = BLINDS[Math.min(BLINDS.length - 1, Math.floor((state.hand - 1) / 5))];
  state.deck = makeDeck();
  state.board = [];
  state.results = null;
  state.reveal = false;
  state.said = {};
  state.street = "preflop";
  state.seats.forEach((s) => {
    s.out = s.chips <= 0;
    s.folded = s.out;
    s.allIn = false;
    s.bet = 0;
    s.total = 0;
    s.cards = [];
  });
  const live = (s: Seat) => !s.out;
  state.dealer = first ? 0 : nextSeat(state, prev.dealer, live);
  const headsUp = state.seats.filter(live).length === 2;
  const sb = headsUp ? state.dealer : nextSeat(state, state.dealer, live);
  const bb = nextSeat(state, sb, live);
  putIn(state.seats[sb], state.blinds[0]);
  putIn(state.seats[bb], state.blinds[1]);
  state.said[sb] = `SB ${state.blinds[0]}`;
  state.said[bb] = `BB ${state.blinds[1]}`;
  for (let round = 0; round < 2; round += 1) {
    state.seats.forEach((s) => {
      if (live(s)) s.cards.push(state.deck.pop()!);
    });
  }
  state.currentBet = state.blinds[1];
  state.minRaise = state.blinds[1];
  state.toAct = state.seats.flatMap((s, i) => (canAct(s) ? [i] : []));
  state.turn = nextSeat(state, bb, (_s, i) => state.toAct.includes(i));
  state.log = `Hand ${state.hand} · blinds ${state.blinds[0]}/${state.blinds[1]}`;
  if (state.toAct.length === 0 || (state.toAct.length === 1 && state.seats[state.toAct[0]].bet >= state.currentBet)) {
    state.toAct = [];
    state.reveal = true;
    return advance(state);
  }
  return state;
}

// Splits the pot into main and side pots and pays the best hands.
function payout(state: State) {
  const contrib = state.seats.map((s) => s.total);
  const results = new Map<number, Result>();
  const strength = state.seats.map((s) => (inHand(s) ? bestHand([...s.cards, ...state.board]) : -1));
  while (contrib.some((c) => c > 0)) {
    const live = state.seats.flatMap((s, i) => (inHand(s) && contrib[i] > 0 ? [i] : []));
    if (live.length === 0) break;
    const level = Math.min(...live.map((i) => contrib[i]));
    let amount = 0;
    contrib.forEach((c, i) => {
      const take = Math.min(c, level);
      amount += take;
      contrib[i] -= take;
    });
    const top = Math.max(...live.map((i) => strength[i]));
    const winners = live.filter((i) => strength[i] === top);
    const share = Math.floor(amount / winners.length);
    let rest = amount - share * winners.length;
    for (const i of winners) {
      const r = results.get(i) ?? { seat: i, amount: 0, hand: handName(top) };
      r.amount += share + (rest > 0 ? 1 : 0);
      rest -= 1;
      results.set(i, r);
    }
  }
  // Chips nobody could win (everyone else folded) go to the last player in.
  const leftover = contrib.reduce((a, b) => a + b, 0);
  if (leftover > 0) {
    const first = [...results.values()][0];
    if (first) first.amount += leftover;
  }
  for (const r of results.values()) state.seats[r.seat].chips += r.amount;
  return [...results.values()];
}

function finishHand(state: State, results: Result[], reveal: boolean): State {
  state.results = results;
  state.reveal = reveal;
  state.street = "showdown";
  state.turn = -1;
  state.toAct = [];
  state.seats.forEach((s) => {
    s.bet = 0;
  });
  const names = results.map((r) => `@[${state.players[r.seat]}] won ${r.amount}${reveal ? ` with ${r.hand}` : ""}`);
  state.log = names.join(" · ");
  const alive = state.seats.filter((s) => s.chips > 0);
  if (alive.length === 1 || state.hand >= MAX_HANDS) {
    const most = Math.max(...state.seats.map((s) => s.chips));
    state.winner = state.players[state.seats.findIndex((s) => s.chips === most)];
    state.log += alive.length === 1 ? " — and took every chip! 🏆" : ` — last hand! Most chips wins 🏆`;
  }
  return state;
}

function advance(state: State): State {
  for (;;) {
    state.seats.forEach((s) => {
      s.bet = 0;
    });
    state.currentBet = 0;
    state.minRaise = state.blinds[1];
    state.said = {};
    if (state.street === "river") {
      return finishHand(state, payout(state), true);
    }
    state.deck.pop();
    if (state.street === "preflop") {
      state.board.push(state.deck.pop()!, state.deck.pop()!, state.deck.pop()!);
      state.street = "flop";
    } else {
      state.board.push(state.deck.pop()!);
      state.street = state.street === "flop" ? "turn" : "river";
    }
    const actors = state.seats.flatMap((s, i) => (canAct(s) ? [i] : []));
    if (actors.length >= 2) {
      state.toAct = actors;
      state.turn = nextSeat(state, state.dealer, (_s, i) => actors.includes(i));
      return state;
    }
    // Everyone (or all but one) is all-in: deal the rest face up.
    state.reveal = true;
  }
}

function applyBet(prev: State, action: Action, seatIndex: number): State {
  const state: State = structuredClone(prev);
  const seat = state.seats[seatIndex];
  const toCall = state.currentBet - seat.bet;
  state.toAct = state.toAct.filter((i) => i !== seatIndex);
  if (action.type === "fold") {
    seat.folded = true;
    state.said[seatIndex] = "Fold";
  } else if (action.type === "check") {
    if (toCall > 0) return prev;
    state.said[seatIndex] = "Check";
  } else if (action.type === "call") {
    if (toCall <= 0) return prev;
    const paid = putIn(seat, toCall);
    state.said[seatIndex] = seat.allIn ? `All-in ${seat.bet}` : `Call ${paid}`;
  } else if (action.type === "raise") {
    const max = seat.bet + seat.chips;
    const to = Math.min(max, Math.floor(action.to));
    const minTo = state.currentBet + state.minRaise;
    if (to <= state.currentBet) return prev;
    if (to < minTo && to < max) return prev;
    putIn(seat, to - seat.bet);
    if (to - state.currentBet >= state.minRaise) state.minRaise = to - state.currentBet;
    state.currentBet = to;
    state.said[seatIndex] = seat.allIn ? `All-in ${to}` : prev.currentBet === 0 ? `Bet ${to}` : `Raise ${to}`;
    state.toAct = state.seats.flatMap((s, i) => (i !== seatIndex && canAct(s) ? [i] : []));
  } else {
    return prev;
  }
  const by = state.players[seatIndex];
  state.log = `${by}|${state.said[seatIndex].toLowerCase()}`;

  const left = state.seats.flatMap((s, i) => (inHand(s) ? [i] : []));
  if (left.length === 1) {
    const total = pot(state);
    state.seats[left[0]].chips += total;
    return finishHand(state, [{ seat: left[0], amount: total, hand: "" }], false);
  }
  if (state.toAct.length === 0) return advance(state);
  state.turn = nextSeat(state, seatIndex, (_s, i) => state.toAct.includes(i));
  return state;
}

// ---------- bot ----------

function preflopStrength(cards: PCard[]) {
  const [a, b] = [...cards].sort((x, y) => y.r - x.r);
  let v = (a.r + b.r) / 28;
  if (a.r === b.r) v = 0.55 + a.r / 30;
  if (a.s === b.s) v += 0.06;
  if (a.r - b.r === 1) v += 0.04;
  return Math.min(1, v);
}

function equity(state: State, seatIndex: number, tries = 140) {
  const mine = state.seats[seatIndex].cards;
  const opponents = state.seats.filter((s, i) => i !== seatIndex && inHand(s)).length;
  const known = new Set([...mine, ...state.board].map((c) => `${c.r}${c.s}`));
  const pool = makeDeck().filter((c) => !known.has(`${c.r}${c.s}`));
  let wins = 0;
  for (let t = 0; t < tries; t += 1) {
    const deck = [...pool];
    const take = () => deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
    const board = [...state.board];
    while (board.length < 5) board.push(take());
    const me = bestHand([...mine, ...board]);
    let best = true;
    let tie = false;
    for (let o = 0; o < opponents; o += 1) {
      const v = bestHand([take(), take(), ...board]);
      if (v > me) best = false;
      if (v === me) tie = true;
    }
    if (best) wins += tie ? 0.5 : 1;
  }
  return wins / tries;
}

function botAction(state: State, seatIndex: number): Action {
  const seat = state.seats[seatIndex];
  const toCall = state.currentBet - seat.bet;
  const total = pot(state);
  const strength = state.street === "preflop" ? preflopStrength(seat.cards) : equity(state, seatIndex);
  const others = state.seats.filter((s, i) => i !== seatIndex && inHand(s)).length;
  // More opponents means a hand needs to be stronger.
  const adj = strength - (state.street === "preflop" ? (others - 1) * 0.05 : 0);
  const mood = Math.random();
  const raiseTo = (fraction: number): Action => {
    const target = state.currentBet + Math.max(state.minRaise, Math.round((total * fraction) / 10) * 10);
    const to = Math.min(seat.bet + seat.chips, target);
    if (to <= state.currentBet) return toCall > 0 ? { type: "call" } : { type: "check" };
    return { type: "raise", to };
  };
  if (adj > 0.8 && mood < 0.7) return raiseTo(mood < 0.25 ? 1 : 0.6);
  if (adj > 0.62 && mood < 0.45) return raiseTo(0.5);
  if (toCall === 0) return mood < 0.08 ? raiseTo(0.5) : { type: "check" };
  const odds = toCall / (total + toCall);
  const stack = toCall / (seat.chips + seat.bet);
  if (adj >= odds + 0.08 || (adj > 0.5 && stack < 0.3) || (mood < 0.06 && stack < 0.15)) return { type: "call" };
  return { type: "fold" };
}

// ---------- view ----------

const LAYOUT: Record<number, [number, number][]> = {
  2: [[50, 6]],
  3: [[18, 14], [82, 14]],
  4: [[10, 40], [50, 4], [90, 40]],
  5: [[8, 46], [24, 6], [76, 6], [92, 46]],
  6: [[7, 52], [14, 12], [50, 2], [86, 12], [93, 52]],
};

function Chips({ amount, className = "" }: { amount: number; className?: string }) {
  if (amount <= 0) return null;
  const stack = Math.min(5, Math.ceil(Math.log10(amount + 1) * 1.6));
  return (
    <span key={amount} className={`poker-bet ${className}`}>
      <span className="chip-stack">
        {Array.from({ length: stack }, (_, i) => (
          CHIP_ART[i % 3] ? <img key={i} src={CHIP_ART[i % 3]} alt="" style={{ bottom: i * 3 }} /> : <i key={i} style={{ bottom: i * 3 }} />
        ))}
      </span>
      {amount}
    </span>
  );
}

function PokerView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const mySeat = state.players.indexOf(me);
  const seat = state.seats[mySeat];
  const myTurn = !finished && state.turn === mySeat && state.street !== "showdown";
  const toCall = seat ? state.currentBet - seat.bet : 0;
  const maxTo = seat ? seat.bet + seat.chips : 0;
  const minTo = Math.min(maxTo, state.currentBet + state.minRaise);
  const [raise, setRaise] = useState(minTo);
  const total = pot(state);
  const isHost = state.players[0] === me;

  useEffect(() => setRaise(minTo), [minTo, state.turn]);
  useOnChange(total, (prev, next) => next > prev && play("chips", 0.8));
  useOnChange(state.board.length, (prev, next) => next > prev && play("deal"));
  useOnChange(state.hand, () => play("card"));
  useOnChange(state.results, (_, next) => next && play(next.some((r) => r.seat === mySeat) ? "coin" : "fold"));

  useEffect(() => {
    if (!state.results || finished) return;
    const hand = state.hand;
    const timer = window.setTimeout(() => act({ type: "next", hand }), isHost ? RESULT_MS : RESULT_MS + 4000);
    return () => window.clearTimeout(timer);
  }, [state.results, state.hand, finished, act, isHost]);

  const order = seatOrder(state.players, me).slice(1);
  const spots = LAYOUT[state.players.length] ?? LAYOUT[6];
  const winners = new Set(state.results?.map((r) => r.seat));
  const showCards = (i: number) => i === mySeat || (state.reveal && inHand(state.seats[i]));
  const best = !seat || !inHand(seat) || seat.cards.length < 2 ? null : state.board.length >= 3 ? handName(bestHand([...seat.cards, ...state.board])) : seat.cards[0].r === seat.cards[1].r ? "Pocket pair" : null;

  const flyRoot = useRef<HTMLDivElement>(null);
  const flyLayer = useCardFlights({ root: flyRoot, me, snapshot: { hands: Object.fromEntries(state.players.map((p, i) => [p, state.seats[i].cards])), pile: [], round: state.hand }, renderFace: (card) => <PlayingCard card={card} />, renderBack: () => <CardBack />, dealLimit: 2 });

  return (
    <div className="board-game poker-game" ref={flyRoot}>
      {flyLayer}
      <div className="poker-table">
        <div className="poker-rail" />
        {order.map((player, k) => {
          const i = state.players.indexOf(player);
          const s = state.seats[i];
          const [x, y] = spots[k];
          return (
            <div
              key={player}
              className={`poker-seat ${state.turn === i ? "is-turn" : ""} ${s.folded ? "is-folded" : ""} ${s.out ? "is-out" : ""} ${winners.has(i) ? "is-winner" : ""}`}
              data-fly-seat={player}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="poker-hole">
                {s.cards.map((c, n) => (showCards(i) ? <PlayingCard key={c.id} card={c} tiny className="deal-in" style={{ animationDelay: `${n * 80}ms` }} /> : <CardBack key={c.id} tiny className="deal-in" style={{ animationDelay: `${n * 80}ms` }} />))}
              </span>
              <span className="poker-name">
                <b>{names[player]}</b>
                <small>{s.out ? "out" : s.allIn ? "ALL-IN" : `🪙 ${s.chips}`}</small>
              </span>
              {i === state.dealer && <span className="dealer-btn">D</span>}
              {state.said[i] && <span key={state.said[i]} className="poker-said">{state.said[i]}</span>}
              <Chips amount={s.bet} />
            </div>
          );
        })}

        <div className="poker-center">
          <div className="poker-board" data-fly-deck>
            {Array.from({ length: 5 }, (_, i) =>
              state.board[i] ? (
                <PlayingCard key={state.board[i].id} card={state.board[i]} small className="flip-in" style={{ animationDelay: `${(i < 3 && state.board.length === 3 ? i : 0) * 120}ms` }} />
              ) : (
                <span key={`slot-${i}`} className="pcard pcard--small pcard--slot" />
              ),
            )}
          </div>
          <span className="poker-pot">
            {CHIP_ART[2] && <img src={CHIP_ART[2]} alt="" />}
            Pot <b>{total}</b>
          </span>
          <small className="poker-hand-no">
            Hand {state.hand}/{MAX_HANDS} · blinds {state.blinds[0]}/{state.blinds[1]}
          </small>
        </div>
      </div>

      {seat && (
        <div className={`poker-me ${state.turn === mySeat ? "is-turn" : ""} ${winners.has(mySeat) ? "is-winner" : ""}`}>
          <Chips amount={seat.bet} className="poker-bet--me" />
          <div className="poker-my-cards" data-fly-hand>
            {seat.cards.map((c, n) => (
              <PlayingCard key={c.id} card={c} className={`deal-in ${seat.folded ? "is-dim" : ""}`} style={{ animationDelay: `${n * 120}ms` }} />
            ))}
            {state.dealer === mySeat && <span className="dealer-btn dealer-btn--me">D</span>}
          </div>
          <span className="poker-my-info">
            <b>🪙 {seat.chips}</b>
            {best && !seat.folded && <small>{best}</small>}
            {seat.folded && <small>Folded</small>}
          </span>
        </div>
      )}

      <LogLine log={state.log} names={names} />

      <div className="poker-actions">
        {myTurn ? (
          <>
            <button type="button" className="poker-btn poker-btn--fold" onClick={() => act({ type: "fold" })}>
              Fold
            </button>
            {toCall > 0 ? (
              <button type="button" className="poker-btn poker-btn--call" onClick={() => act({ type: "call" })}>
                {toCall >= seat.chips ? `All-in ${seat.chips}` : `Call ${toCall}`}
              </button>
            ) : (
              <button type="button" className="poker-btn poker-btn--call" onClick={() => act({ type: "check" })}>
                Check
              </button>
            )}
            {maxTo > state.currentBet && maxTo > toCall + seat.bet && (
              <div className="poker-raise">
                <div className="poker-presets">
                  {[
                    ["½ pot", state.currentBet + Math.round(total / 2)],
                    ["Pot", state.currentBet + total],
                    ["All-in", maxTo],
                  ].map(([label, to]) => (
                    <button key={label} type="button" onClick={() => setRaise(Math.max(minTo, Math.min(maxTo, Number(to))))}>
                      {label}
                    </button>
                  ))}
                </div>
                <input type="range" min={minTo} max={maxTo} step={state.blinds[0]} value={raise} onChange={(e) => setRaise(Number(e.target.value))} aria-label="Raise amount" />
                <button type="button" className="poker-btn poker-btn--raise" onClick={() => act({ type: "raise", to: raise })}>
                  {raise >= maxTo ? "All-in" : state.currentBet === 0 ? "Bet" : "Raise to"} {raise}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="turn-label">
            {finished
              ? "Game over"
              : state.results
                ? "Next hand coming…"
                : seat?.folded
                  ? "You folded — watch the hand"
                  : `${names[state.players[state.turn]] ?? "…"} is thinking…`}
          </p>
        )}
      </div>
    </div>
  );
}

export const pokerGame: GameDef<State, Action> = {
  id: "poker",
  title: "Poker",
  tagline: "Texas Hold'em. Bluff, bet, take every chip.",
  emoji: "♠️",
  className: "game-card--poker has-cover",
  minPlayers: 2,
  maxPlayers: 6,
  botDelay: 1100,
  felt: true,
  init: (players) =>
    startHand(
      {
        players,
        seats: players.map(() => ({ chips: START_CHIPS, bet: 0, total: 0, folded: false, allIn: false, out: false, cards: [] })),
        deck: [],
        board: [],
        dealer: 0,
        turn: 0,
        street: "preflop",
        toAct: [],
        currentBet: 0,
        minRaise: 0,
        hand: 0,
        blinds: BLINDS[0],
        results: null,
        reveal: false,
        said: {},
        log: "",
        winner: null,
      },
      true,
    ),
  apply: (state, action, by) => {
    if (state.winner) return state;
    if (action.type === "next") {
      if (!state.results || action.hand !== state.hand) return state;
      return startHand(state);
    }
    const seat = state.players.indexOf(by);
    if (seat !== state.turn || state.street === "showdown") return state;
    return applyBet(state, action, seat);
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => (state.turn >= 0 && state.street !== "showdown" ? state.players[state.turn] : null),
  botMove: (state, bot) => botAction(state, state.players.indexOf(bot)),
  View: PokerView,
};
