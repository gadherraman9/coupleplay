import { useEffect, useRef } from "react";
import type { GameDef, GameViewProps } from "./types";
import { CardBack, cardLabel, makeDeck, PlayingCard, seatOrder, sortHand, useTableSound } from "./deck";
import type { PCard, Suit } from "./deck";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";
import { useCardFlights } from "./cardFly";

// Call Break: 4 players, 13 cards each, spades are always trump.
// Bid how many tricks you'll win; make it and score your bid (+0.1 per extra
// trick), miss and lose your bid. Highest total after ROUNDS rounds wins.
const ROUNDS = 5;
const MAX_BID = 8;
const ROUND_MS = 4200;

interface Played {
  seat: number;
  card: PCard;
}

interface State {
  players: string[];
  hands: PCard[][];
  phase: "bid" | "play" | "roundEnd";
  bids: (number | null)[];
  tricks: number[];
  trick: Played[];
  lastTrick: { cards: Played[]; winner: number } | null;
  played: PCard[];
  turn: number;
  dealer: number;
  round: number;
  scores: number[][];
  log: string;
  winner: string | null;
}

type Action = { type: "bid"; bid: number } | { type: "play"; card: number } | { type: "next"; round: number };

const total = (state: State, seat: number) => Math.round(state.scores.reduce((sum, r) => sum + (r[seat] ?? 0), 0) * 10) / 10;

function deal(prev: State, round: number, dealer: number): State {
  const deck = makeDeck();
  const hands = [0, 1, 2, 3].map((i) => sortHand(deck.slice(i * 13, i * 13 + 13)));
  const first = (dealer + 1) % 4;
  return {
    ...prev,
    hands,
    phase: "bid",
    bids: [null, null, null, null],
    tricks: [0, 0, 0, 0],
    trick: [],
    lastTrick: null,
    played: [],
    turn: first,
    dealer,
    round,
    log: `Round ${round} of ${ROUNDS} — call your tricks`,
  };
}

function trickWinner(trick: Played[]) {
  const lead = trick[0].card.s;
  let best = trick[0];
  for (const p of trick.slice(1)) {
    const c = p.card;
    const b = best.card;
    if (c.s === "S" && b.s !== "S") best = p;
    else if (c.s === b.s && c.r > b.r) best = p;
    else if (c.s === lead && b.s === lead && c.r > b.r) best = p;
  }
  return best.seat;
}

// Follow suit (and beat it if you can); if you can't follow, trump (and
// over-trump if you can); otherwise play anything.
export function legalCards(hand: PCard[], trick: Played[]) {
  if (trick.length === 0) return hand;
  const lead = trick[0].card.s as Suit;
  const follow = hand.filter((c) => c.s === lead);
  const trumped = trick.some((p) => p.card.s === "S") && lead !== "S";
  if (follow.length) {
    if (trumped) return follow;
    const high = Math.max(...trick.filter((p) => p.card.s === lead).map((p) => p.card.r));
    const beat = follow.filter((c) => c.r > high);
    return beat.length ? beat : follow;
  }
  const spades = hand.filter((c) => c.s === "S");
  if (spades.length) {
    const high = Math.max(0, ...trick.filter((p) => p.card.s === "S").map((p) => p.card.r));
    const over = spades.filter((c) => c.r > high);
    return over.length ? over : hand;
  }
  return hand;
}

function botBid(hand: PCard[]) {
  let est = 0;
  const bySuit = (s: Suit) => hand.filter((c) => c.s === s);
  for (const s of ["H", "D", "C"] as Suit[]) {
    const cards = bySuit(s);
    if (cards.some((c) => c.r === 14)) est += 1;
    if (cards.some((c) => c.r === 13) && cards.length >= 2 && cards.length <= 5) est += 0.75;
    if (cards.some((c) => c.r === 12) && cards.length >= 3 && cards.length <= 4) est += 0.3;
    if (cards.length <= 1) est += 0.4 * Math.min(2, bySuit("S").length - 2 > 0 ? 1 : 0);
  }
  const spades = bySuit("S");
  for (const c of spades) if (c.r >= 12) est += c.r === 14 ? 1 : 0.8;
  est += Math.max(0, spades.length - 3) * 0.8;
  return Math.max(1, Math.min(MAX_BID, Math.round(est)));
}

function botPlay(state: State, seat: number) {
  const hand = state.hands[seat];
  const legal = legalCards(hand, state.trick);
  const needs = (state.bids[seat] ?? 0) > state.tricks[seat];
  const low = (cards: PCard[]) => [...cards].sort((a, b) => (a.s === "S" ? 1 : 0) - (b.s === "S" ? 1 : 0) || a.r - b.r)[0];
  const isTop = (c: PCard) => {
    const gone = new Set(state.played.filter((p) => p.s === c.s).map((p) => p.r));
    for (let r = c.r + 1; r <= 14; r += 1) if (!gone.has(r) && !hand.some((h) => h.s === c.s && h.r === r)) return false;
    return true;
  };
  if (state.trick.length === 0) {
    if (needs) {
      const winner = legal.find((c) => c.s !== "S" && isTop(c)) ?? legal.find((c) => c.s === "S" && isTop(c));
      if (winner) return winner;
    }
    return low(legal.filter((c) => c.s !== "S").length ? legal.filter((c) => c.s !== "S") : legal);
  }
  const winning = legal.filter((c) => trickWinner([...state.trick, { seat, card: c }]) === seat);
  if (needs && winning.length) {
    // Last to play: the cheapest winner. Otherwise a card likely to hold.
    const sorted = [...winning].sort((a, b) => (a.s === "S" ? 100 : 0) + a.r - ((b.s === "S" ? 100 : 0) + b.r));
    return state.trick.length === 3 ? sorted[0] : sorted.find(isTop) ?? sorted[sorted.length - 1];
  }
  const losing = legal.filter((c) => !winning.includes(c));
  return losing.length ? [...losing].sort((a, b) => b.r - a.r)[0] : low(legal);
}

// ---------- view ----------

const SPOT = ["bottom", "left", "top", "right"] as const;

function CallBreakView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  useTableSound();
  const mySeat = state.players.indexOf(me);
  const myTurn = !finished && state.turn === mySeat;
  const hand = state.hands[mySeat] ?? [];
  const legal = myTurn && state.phase === "play" ? new Set(legalCards(hand, state.trick).map((c) => c.id)) : new Set<number>();
  const order = seatOrder([0, 1, 2, 3], Math.max(0, mySeat));
  const spotOf = (seat: number) => SPOT[order.indexOf(seat)];
  const isHost = state.players[0] === me;
  useOnChange(state.played.length + state.trick.length, (prev, next) => next > prev && play("card"));
  useOnChange(state.lastTrick?.winner, (_, w) => w !== undefined && play(w === mySeat ? "coin" : "draw", 0.7));
  useOnChange(state.round, () => play("deal"));

  useEffect(() => {
    if (state.phase !== "roundEnd" || finished) return;
    const round = state.round;
    const timer = window.setTimeout(() => act({ type: "next", round }), isHost ? ROUND_MS : ROUND_MS + 4000);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.round, finished, act, isHost]);

  const center = state.trick.length ? state.trick : state.lastTrick?.cards ?? [];
  const collecting = state.trick.length === 0 && state.lastTrick ? spotOf(state.lastTrick.winner) : null;

  const flyRoot = useRef<HTMLDivElement>(null);
  const flyLayer = useCardFlights({
    root: flyRoot,
    me,
    snapshot: { hands: Object.fromEntries(state.players.map((p, i) => [p, state.hands[i] ?? []])), pile: (state.trick.length ? state.trick : state.lastTrick?.cards ?? []).map((p) => p.card), round: state.round },
    renderFace: (card) => <PlayingCard card={card} small />,
    renderBack: () => <CardBack small />,
    dealLimit: 5,
  });

  return (
    <div className="board-game cb-game" ref={flyRoot}>
      {flyLayer}
      <div className="cb-table">
        {[0, 1, 2, 3].filter((s) => s !== mySeat).map((seat) => (
          <div key={seat} className={`cb-seat cb-seat--${spotOf(seat)} ${state.turn === seat && !finished ? "is-turn" : ""}`} data-fly-seat={state.players[seat]}>
            <span className="cb-fan">
              {state.hands[seat].slice(0, 13).map((c) => (
                <CardBack key={c.id} tiny />
              ))}
            </span>
            <span className="cb-name">
              <b>{names[state.players[seat]]}</b>
              <small>
                {state.bids[seat] === null ? (state.phase === "bid" ? "bidding…" : "") : `${state.tricks[seat]}/${state.bids[seat]}`} · {total(state, seat)}
              </small>
            </span>
          </div>
        ))}

        <div className={`cb-trick ${collecting ? `is-collect is-collect--${collecting}` : ""}`} key={collecting ? `c${state.played.length}` : "live"}>
          {center.map((p) => (
            <span key={p.card.id} className={`cb-played cb-played--${spotOf(p.seat)}`} data-fly-pile={p.card.id}>
              <PlayingCard card={p.card} small />
            </span>
          ))}
          {state.phase === "bid" && <span className="cb-trump">♠ Spades are trump</span>}
        </div>
      </div>

      <div className={`cb-me ${myTurn ? "is-turn" : ""}`}>
        <span className="cb-name cb-name--me">
          <b>You</b>
          <small>
            {state.bids[mySeat] === null ? "Your call" : `Won ${state.tricks[mySeat]} of ${state.bids[mySeat]}`} · total {total(state, mySeat)}
          </small>
        </span>
      </div>

      <LogLine log={state.log} names={names} />

      {state.phase === "bid" && myTurn && (
        <div className="cb-bids" role="group" aria-label="Your bid">
          <span>How many tricks will you win?</span>
          <div>
            {Array.from({ length: MAX_BID }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => act({ type: "bid", bid: n })}>
                {n}
              </button>
            ))}
          </div>
          <small>Suggested: {botBid(hand)}</small>
        </div>
      )}

      {state.phase === "roundEnd" && (
        <div className="cb-scores">
          <strong>{finished ? "Final scores" : `Round ${state.round} scores`}</strong>
          <table>
            <thead>
              <tr>
                <th />
                {state.players.map((p) => (
                  <th key={p}>{names[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.scores.map((row, r) => (
                <tr key={r}>
                  <td>R{r + 1}</td>
                  {row.map((v, s) => (
                    <td key={s} className={v < 0 ? "is-neg" : ""}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="is-total">
                <td>Total</td>
                {state.players.map((_, s) => (
                  <td key={s}>{total(state, s)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="my-hand cb-hand">
        {hand.map((card, i) => {
          const ok = legal.has(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`hand-card ${ok ? "is-playable" : ""} ${myTurn && state.phase === "play" && !ok ? "is-blocked" : ""}`}
              data-fly-card={card.id}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              disabled={!ok}
              onClick={() => act({ type: "play", card: card.id })}
            >
              <PlayingCard card={card} small />
            </button>
          );
        })}
      </div>

      <p className="turn-label">
        {finished
          ? "Game over"
          : state.phase === "roundEnd"
            ? "Next round coming…"
            : myTurn
              ? state.phase === "bid"
                ? "Make your call"
                : "Your turn — glowing cards can be played"
              : `${names[state.players[state.turn]]} is ${state.phase === "bid" ? "bidding" : "thinking"}…`}
      </p>
    </div>
  );
}

export const callBreakGame: GameDef<State, Action> = {
  id: "callbreak",
  title: "Call Break",
  tagline: "Call your tricks, spades are trump. 4 players.",
  emoji: "♣️",
  className: "game-card--callbreak has-cover",
  minPlayers: 2,
  maxPlayers: 4,
  fillTo: 4,
  felt: true,
  botDelay: 900,
  init: (players) =>
    deal(
      {
        players,
        hands: [],
        phase: "bid",
        bids: [],
        tricks: [],
        trick: [],
        lastTrick: null,
        played: [],
        turn: 0,
        dealer: 3,
        round: 1,
        scores: [],
        log: "",
        winner: null,
      },
      1,
      3,
    ),
  apply: (state, action, by) => {
    if (state.winner) return state;
    if (action.type === "next") {
      if (state.phase !== "roundEnd" || action.round !== state.round) return state;
      return deal(state, state.round + 1, (state.dealer + 1) % 4);
    }
    const seat = state.players.indexOf(by);
    if (seat !== state.turn) return state;
    if (action.type === "bid") {
      if (state.phase !== "bid" || action.bid < 1 || action.bid > MAX_BID) return state;
      const bids = [...state.bids];
      bids[seat] = action.bid;
      const done = bids.every((b) => b !== null);
      const first = (state.dealer + 1) % 4;
      return {
        ...state,
        bids,
        phase: done ? "play" : "bid",
        turn: done ? first : (seat + 1) % 4,
        log: `${by}|called ${action.bid}${done ? " — let's play!" : ""}`,
      };
    }
    if (action.type !== "play" || state.phase !== "play") return state;
    const card = state.hands[seat].find((c) => c.id === action.card);
    if (!card || !legalCards(state.hands[seat], state.trick).some((c) => c.id === card.id)) return state;
    const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h));
    const trick = [...state.trick, { seat, card }];
    if (trick.length < 4) {
      return { ...state, hands, trick, turn: (seat + 1) % 4, log: `${by}|played ${cardLabel(card)}` };
    }
    const winner = trickWinner(trick);
    const tricks = [...state.tricks];
    tricks[winner] += 1;
    const played = [...state.played, ...trick.map((p) => p.card)];
    const next: State = { ...state, hands, trick: [], lastTrick: { cards: trick, winner }, played, tricks, turn: winner, log: `${state.players[winner]}|won the trick` };
    if (hands[0].length > 0) return next;
    const row = state.bids.map((bid, s) => (tricks[s] >= bid! ? Math.round((bid! + (tricks[s] - bid!) / 10) * 10) / 10 : -bid!));
    const scores = [...state.scores, row];
    const ended: State = { ...next, scores, phase: "roundEnd", turn: -1, log: "Round over!" };
    if (state.round >= ROUNDS) {
      const totals = state.players.map((_, s) => total(ended, s));
      const best = Math.max(...totals);
      return { ...ended, winner: state.players[totals.indexOf(best)], log: `${state.players[totals.indexOf(best)]}|wins with ${best} points! 🏆` };
    }
    return ended;
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => (state.turn >= 0 ? state.players[state.turn] : null),
  botMove: (state, bot) => {
    const seat = state.players.indexOf(bot);
    if (state.phase === "bid") return { type: "bid", bid: botBid(state.hands[seat]) };
    if (state.phase !== "play") return null;
    return { type: "play", card: botPlay(state, seat).id };
  },
  View: CallBreakView,
};
