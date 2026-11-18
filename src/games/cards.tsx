import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameDef, GameViewProps } from "./types";
import { shuffle } from "./types";
import { useCardFlights } from "./cardFly";
import { CardBack } from "./deck";
import { LogLine } from "./ui";
import { useSkin } from "../skins";
import { UserAvatar } from "../components/Avatar";
import { backStyle, useTableSound } from "./deck";

type Color = "red" | "yellow" | "green" | "blue";
type Value = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

interface Card {
  id: number;
  color: Color | "wild";
  value: Value;
}

interface State {
  players: string[];
  hands: Record<string, Card[]>;
  deck: Card[];
  discard: Card[];
  color: Color;
  turn: number;
  direction: 1 | -1;
  drew: boolean;
  drawnCard: number | null;
  log: string;
  winner: string | null;
}

type Action = { type: "play"; card: number; color?: Color } | { type: "draw" } | { type: "pass" } | { type: "call" };

const COLORS: Color[] = ["red", "yellow", "green", "blue"];
const HEX: Record<Color | "wild", string> = {
  red: "#ef4444",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  wild: "#1f1630",
};
const LABEL: Partial<Record<Value, string>> = { skip: "⊘", reverse: "⇄", draw2: "+2", wild: "★", wild4: "+4" };

function makeDeck() {
  const cards: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, color, value: "0" });
    for (const value of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"] as Value[]) {
      cards.push({ id: id++, color, value }, { id: id++, color, value });
    }
  }
  for (let i = 0; i < 4; i += 1) {
    cards.push({ id: id++, color: "wild", value: "wild" }, { id: id++, color: "wild", value: "wild4" });
  }
  return shuffle(cards);
}

function playable(state: State, card: Card) {
  if (state.drew && card.id !== state.drawnCard) return false;
  const top = state.discard[state.discard.length - 1];
  return card.color === "wild" || card.color === state.color || card.value === top.value;
}

function draw(state: State, count: number) {
  let deck = [...state.deck];
  let discard = [...state.discard];
  const drawn: Card[] = [];
  for (let i = 0; i < count; i += 1) {
    if (deck.length === 0) {
      const top = discard.pop()!;
      deck = shuffle(discard);
      discard = [top];
    }
    const card = deck.pop();
    if (card) drawn.push(card);
  }
  return { deck, discard, drawn };
}

const step = (state: State, by: number, times = 1) =>
  (((by + state.direction * times) % state.players.length) + state.players.length) % state.players.length;

export function CardFace({ card, small, style }: { card: Card; small?: boolean; style?: CSSProperties }) {
  const label = LABEL[card.value] ?? card.value;
  const wild = card.color === "wild";
  return (
    <span
      className={`uno-card ${small ? "uno-card--small" : ""} ${wild ? "is-wild" : ""}`}
      style={{ ["--card" as string]: wild ? "#20242b" : HEX[card.color], ...style }}
    >
      <span className="uno-card-corner">{label}</span>
      {wild ? (
        <span className="uno-wild">
          <span className="uno-wild-square" aria-hidden="true">
            {COLORS.map((color) => <i key={color} style={{ background: HEX[color] }} />)}
          </span>
          <b>{card.value === "wild4" ? "+4" : "Wild"}</b>
        </span>
      ) : (
        <span className="uno-card-oval">{label}</span>
      )}
      <span className="uno-card-corner uno-card-corner--br">{label}</span>
    </span>
  );
}

// A fixed tilt per card id, so the pile looks tossed but is the same everywhere.
const tilt = (id: number) => ((id * 37) % 21) - 10;

function CardsView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const backLook = backStyle(useSkin("cards"));
  useTableSound();
  const current = state.players[state.turn];
  const myTurn = current === me && !finished;
  const hand = state.hands[me] ?? [];
  const opponents = state.players.filter((player) => player !== me);
  // One opponent sits at the top, two on the sides, three around the top half.
  const slots = ["top", "left", "right"] as const;
  const slotFor = (index: number) => (opponents.length === 1 ? "top" : opponents.length === 2 ? (index === 0 ? "left" : "right") : slots[index]);
  const cardName = (card: Card) => `${card.color === "wild" ? "Wild" : card.color} ${LABEL[card.value] ?? card.value}`;
  const canCall = !finished && hand.length <= 2;
  const hint = finished
    ? "Match complete"
    : myTurn
      ? state.drew ? "Play the drawn card or pass" : hand.some((card) => playable(state, card)) ? "Tap a glowing card" : "No match — draw a card"
      : `${names[current]} is playing…`;

  const flyRoot = useRef<HTMLDivElement>(null);
  const flyLayer = useCardFlights({ root: flyRoot, me, snapshot: { hands: state.hands, pile: state.discard, round: 0 }, renderFace: (card) => <CardFace card={card} />, renderBack: () => <CardBack /> });

  return (
    <div className="board-game cards-game" ref={flyRoot}>
      {flyLayer}
      <div className="uno-hud">
        <button type="button" className="uno-call" disabled={!canCall} onClick={() => act({ type: "call" })} aria-label="Call UNO">
          UNO!
        </button>
        <span className="uno-hud-title">
          <small>COLOR CARDS</small>
          <b>{state.deck.length} left in deck</b>
        </span>
        <span className="uno-color-badge" style={{ ["--c" as string]: HEX[state.color] }}>
          <i aria-hidden="true" /> {state.color}
        </span>
        <span className="uno-dir" aria-label={state.direction === 1 ? "Clockwise" : "Counter-clockwise"}>
          {state.direction === 1 ? "↻" : "↺"}
        </span>
      </div>

      <div className="uno-table">
        <svg className={`uno-loop ${state.direction === -1 ? "is-reverse" : ""}`} viewBox="0 0 260 150" aria-hidden="true">
          <defs>
            <marker id="uno-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0 10 5 0 10 Z" fill="currentColor" />
            </marker>
          </defs>
          <path d="M62 22C24 46 24 98 58 122" markerEnd="url(#uno-arrow)" />
          <path d="M198 22C236 46 236 98 202 122" markerEnd="url(#uno-arrow)" />
        </svg>

        {opponents.map((player, index) => {
          const count = state.hands[player].length;
          return (
            <div key={player} className={`uno-seat uno-seat--${slotFor(index)} ${player === current ? "is-turn" : ""}`} data-fly-seat={player}>
              <span className="uno-seat-name">
                <i className="uno-online" aria-hidden="true" />
                <b>{names[player]}</b>
                {count === 1 && <em>UNO!</em>}
              </span>
              <span className="uno-avatar">
                <UserAvatar id={player} size={44} showOnline={false} />
                <i className="uno-count">{count}</i>
              </span>
            </div>
          );
        })}

        <div className="uno-center">
          <button
            type="button"
            className="card-back card-back--deck"
            data-fly-deck
            style={backLook}
            disabled={!myTurn || state.drew}
            onClick={() => act({ type: "draw" })}
            aria-label="Draw a card"
          >
            <span>{myTurn && !state.drew ? "Draw" : "Deck"}</span>
          </button>
          <span className="discard-pile" data-fly-pile-spot>
            <span className="uno-color-ring" style={{ borderColor: HEX[state.color] }} aria-hidden="true" />
            {state.discard.slice(-3).map((card, i, pile) => (
              <span key={card.id} data-fly-pile={card.id} className={`discard-card ${i === pile.length - 1 ? "is-top" : ""}`} style={{ transform: `rotate(${tilt(card.id)}deg)` }}>
                <CardFace card={card} />
              </span>
            ))}
          </span>
        </div>

        <div className="uno-log">
          <LogLine log={state.log} names={names} />
        </div>
      </div>

      {choosing !== null && (
        <div className="color-picker" role="dialog" aria-label="Pick a color">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              style={{ background: HEX[color] }}
              onClick={() => {
                act({ type: "play", card: choosing, color });
                setChoosing(null);
              }}
              aria-label={color}
            />
          ))}
        </div>
      )}

      <div className={`uno-dock ${myTurn ? "is-turn" : ""}`}>
        <div className={`uno-now ${myTurn ? "is-you" : ""}`}>
          <span className="uno-now-avatar">
            <UserAvatar id={current} size={36} showOnline={false} />
          </span>
          <span className="uno-now-pill" role="status">
            {myTurn ? "Your Turn" : finished ? "Game over" : `${names[current]}'s turn`}
          </span>
          <i className="uno-timer" aria-hidden="true" />
        </div>
        <div className="uno-dock-meta">
          <span>
            <b>You</b> · {hand.length} {hand.length === 1 ? "card" : "cards"}
          </span>
          {myTurn && state.drew ? (
            <button type="button" className="ghost-btn uno-pass" onClick={() => act({ type: "pass" })}>
              Pass
            </button>
          ) : (
            <small className="uno-hint">{hint}</small>
          )}
        </div>
        <div className="uno-hand-scroll">
          <div className="my-hand" data-fly-hand>
            {hand.map((card, i) => {
              const ok = myTurn && playable(state, card);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`hand-card ${ok ? "is-playable" : ""}`}
                  data-fly-card={card.id}
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                  disabled={!ok}
                  aria-label={`Play ${cardName(card)}`}
                  onClick={() => (card.color === "wild" ? setChoosing(card.id) : act({ type: "play", card: card.id }))}
                >
                  <CardFace card={card} small />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const cardsGame: GameDef<State, Action> = {
  id: "cards",
  title: "Color Cards",
  tagline: "Match colors and numbers, empty your hand first.",
  emoji: "🃏",
  className: "game-card--cards",
  felt: true,
  minPlayers: 2,
  maxPlayers: 4,
  init: (players) => {
    let deck = makeDeck();
    const hands: Record<string, Card[]> = {};
    for (const player of players) {
      hands[player] = deck.slice(0, 7);
      deck = deck.slice(7);
    }
    let first = deck.findIndex((card) => /^[0-9]$/.test(card.value));
    if (first < 0) first = 0;
    const top = deck[first];
    deck = deck.filter((_, i) => i !== first);
    return {
      players,
      hands,
      deck,
      discard: [top],
      color: top.color as Color,
      turn: 0,
      direction: 1,
      drew: false,
      drawnCard: null,
      log: "Match the color or number. Wild cards go on anything!",
      winner: null,
    };
  },
  apply: (state, action, by) => {
    if (state.winner) return state;
    if (action.type === "call") {
      const hand = state.hands[by];
      if (!hand || hand.length > 2) return state;
      return { ...state, log: `${by}|yelled UNO!` };
    }
    const seat = state.players.indexOf(by);
    if (seat !== state.turn) return state;

    if (action.type === "draw") {
      if (state.drew) return state;
      const { deck, discard, drawn } = draw(state, 1);
      return { ...state, deck, discard, hands: { ...state.hands, [by]: [...state.hands[by], ...drawn] }, drew: true, drawnCard: drawn[0]?.id ?? null, log: `${by}|drew a card` };
    }
    if (action.type === "pass") {
      if (!state.drew) return state;
      return { ...state, drew: false, drawnCard: null, turn: step(state, seat), log: `${by}|passed` };
    }

    const card = state.hands[by].find((c) => c.id === action.card);
    if (!card || !playable(state, card)) return state;
    const hand = state.hands[by].filter((c) => c.id !== card.id);
    let next: State = {
      ...state,
      hands: { ...state.hands, [by]: hand },
      discard: [...state.discard, card],
      color: card.color === "wild" ? action.color ?? "red" : card.color,
      drew: false,
      drawnCard: null,
    };
    let log = `played ${card.color === "wild" ? "" : `${card.color} `}${LABEL[card.value] ?? card.value}${card.color === "wild" ? ` and picked ${next.color}` : ""}`;
    if (hand.length === 1) log += " — LAST CARD!";

    let skip = 1;
    if (card.value === "reverse") {
      if (state.players.length === 2) skip = 2;
      else next = { ...next, direction: (state.direction * -1) as 1 | -1 };
    }
    if (card.value === "skip") skip = 2;
    if (card.value === "draw2" || card.value === "wild4") {
      const victimSeat = step(next, seat);
      const victim = state.players[victimSeat];
      const { deck, discard, drawn } = draw(next, card.value === "draw2" ? 2 : 4);
      next = { ...next, deck, discard, hands: { ...next.hands, [victim]: [...next.hands[victim], ...drawn] } };
      log += ` — @[${victim}] drew ${drawn.length} cards`;
      skip = 2;
    }
    if (hand.length === 0) return { ...next, winner: by, log: `${by}|${log} — played the last card and won!` };
    return { ...next, turn: step(next, seat, skip), log: `${by}|${log}` };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => state.players[state.turn],
  botDelay: 750,
  botMove: (state, bot) => {
    const hand = state.hands[bot];
    const options = hand.filter((card) => playable(state, card));
    if (options.length) {
      const card = options.find((c) => c.color !== "wild") ?? options[0];
      const counts = COLORS.map((color) => hand.filter((c) => c.color === color).length);
      const color = COLORS[counts.indexOf(Math.max(...counts))];
      return { type: "play", card: card.id, color };
    }
    return state.drew ? { type: "pass" } : { type: "draw" };
  },
  View: CardsView,
};
