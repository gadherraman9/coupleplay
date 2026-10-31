import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { GameDef, GameViewProps } from "./types";
import { shuffle } from "./types";
import { useCardFlights } from "./cardFly";
import { CardBack } from "./deck";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";
import { skinArt, useSkin } from "../skins";

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
  log: string;
  winner: string | null;
}

type Action = { type: "play"; card: number; color?: Color } | { type: "draw" } | { type: "pass" };

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
  return (
    <span
      className={`uno-card ${small ? "uno-card--small" : ""} ${card.color === "wild" ? "is-wild" : ""}`}
      style={{ ["--card" as string]: HEX[card.color], ...style }}
    >
      <span className="uno-card-oval" style={{ color: card.color === "wild" ? "#1f1630" : HEX[card.color] }}>
        {label}
      </span>
      <small>{label}</small>
      <small className="uno-card-corner">{label}</small>
    </span>
  );
}

// A fixed tilt per card id, so the pile looks tossed but is the same everywhere.
const tilt = (id: number) => ((id * 37) % 21) - 10;

function CardsView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const backArt = skinArt(useSkin("cards").back);
  const backStyle = backArt ? { backgroundImage: `url(${backArt})`, backgroundSize: "cover" } : undefined;
  const current = state.players[state.turn];
  const myTurn = current === me && !finished;
  const hand = state.hands[me] ?? [];
  const totalCards = state.players.reduce((n, p) => n + state.hands[p].length, 0);
  useOnChange(state.discard.length, (prev, next) => next > prev && play("card"));
  useOnChange(totalCards, (prev, next) => next > prev && play("draw"));
  useOnChange(state.color, () => state.discard[state.discard.length - 1]?.color === "wild" && play("coin"));

  const flyRoot = useRef<HTMLDivElement>(null);
  const flyLayer = useCardFlights({ root: flyRoot, me, snapshot: { hands: state.hands, pile: state.discard, round: 0 }, renderFace: (card) => <CardFace card={card} />, renderBack: () => <CardBack /> });

  return (
    <div className="board-game cards-game" ref={flyRoot}>
      {flyLayer}
      <div className="opponents">
        {state.players.filter((p) => p !== me).map((player) => (
          <span key={player} className={`opponent ${player === current ? "is-turn" : ""}`} data-fly-seat={player}>
            <span className="opponent-fan">
              {Array.from({ length: Math.min(state.hands[player].length, 7) }, (_, i) => (
                <span key={i} className="card-back" style={backStyle} />
              ))}
            </span>
            <strong>{names[player]}</strong>
            <small>{state.hands[player].length === 1 ? "LAST CARD!" : `${state.hands[player].length} cards`}</small>
          </span>
        ))}
      </div>

      <div className="table-center">
        <button type="button" className="card-back card-back--deck" style={backStyle} disabled={!myTurn || state.drew} onClick={() => act({ type: "draw" })} aria-label="Draw a card">
          <span>Draw</span>
        </button>
        <span className="discard-pile" data-fly-pile-spot>
          {state.discard.slice(-3).map((card, i, pile) => (
            <span key={card.id} data-fly-pile={card.id} className={`discard-card ${i === pile.length - 1 ? "is-top" : ""}`} style={{ transform: `rotate(${tilt(card.id)}deg)` }}>
              <CardFace card={card} />
            </span>
          ))}
        </span>
        <span className="table-info">
          <span key={state.color} className="current-color" style={{ background: HEX[state.color] }} title={`Color: ${state.color}`} />
          <span key={state.direction} className="direction">{state.direction === 1 ? "↻" : "↺"}</span>
        </span>
      </div>

      <LogLine log={state.log} names={names} />

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

      <div className="my-hand">
        {hand.map((card, i) => {
          const ok = myTurn && playable(state, card);
          return (
            <button
              key={card.id}
              type="button"
              className={`hand-card ${ok ? "is-playable" : ""}`}
              data-fly-card={card.id}
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              disabled={!ok}
              onClick={() => (card.color === "wild" ? setChoosing(card.id) : act({ type: "play", card: card.id }))}
            >
              <CardFace card={card} small />
            </button>
          );
        })}
      </div>

      <div className="board-actions">
        {myTurn && state.drew ? (
          <button type="button" className="ghost-btn" onClick={() => act({ type: "pass" })}>
            Pass turn
          </button>
        ) : (
          <p className="turn-label">{finished ? "Game over" : myTurn ? "Your turn — play a card or draw" : `${names[current]} is thinking…`}</p>
        )}
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
      log: "Match the color or number. Wild cards go on anything!",
      winner: null,
    };
  },
  apply: (state, action, by) => {
    if (state.winner) return state;
    const seat = state.players.indexOf(by);
    if (seat !== state.turn) return state;

    if (action.type === "draw") {
      if (state.drew) return state;
      const { deck, discard, drawn } = draw(state, 1);
      return { ...state, deck, discard, hands: { ...state.hands, [by]: [...state.hands[by], ...drawn] }, drew: true, log: `${by}|drew a card` };
    }
    if (action.type === "pass") {
      if (!state.drew) return state;
      return { ...state, drew: false, turn: step(state, seat), log: `${by}|passed` };
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
    };
    let log = `played ${card.color === "wild" ? "" : `${card.color} `}${LABEL[card.value] ?? card.value}${card.color === "wild" ? ` and picked ${next.color}` : ""}`;
    if (hand.length === 0) return { ...next, winner: by, log: `${by}|played the last card and won! 🎉` };
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
