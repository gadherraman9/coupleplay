import { useEffect, useMemo, useRef, useState } from "react";
import type { GameDef, GameViewProps } from "./types";
import { CardBack, cardLabel, makeDeck, PlayingCard, rankLabel, seatOrder, useTableSound } from "./deck";
import type { PCard } from "./deck";
import { shuffle } from "./types";
import { useCardFlights } from "./cardFly";
import { play } from "./sfx";
import { LogLine, useOnChange } from "./ui";

// 13-card Indian Rummy with two decks, two printed jokers and a wild joker
// rank. Make sequences and sets; a valid show needs at least two sequences,
// one of them pure (no jokers). Losers score the points left in their hand
// (max 80). Lowest total after DEALS deals wins.
const DEALS = 3;
const MAX_POINTS = 80;
const DEAL_MS = 5200;

type MeldKind = "pure" | "seq" | "set";

interface Arrangement {
  melds: { kind: MeldKind; cards: number[] }[];
  dead: number[];
  points: number;
  valid: boolean;
}

interface State {
  players: string[];
  hands: PCard[][];
  deck: PCard[];
  discard: PCard[];
  wild: number;
  wildCard: PCard;
  turn: number;
  phase: "draw" | "discard" | "dealEnd";
  drewFrom: "deck" | "discard" | null;
  deal: number;
  starter: number;
  scores: number[][];
  shown: { seat: number; valid: boolean } | null;
  log: string;
  winner: string | null;
}

type Action =
  | { type: "draw"; from: "deck" | "discard" }
  | { type: "discard"; card: number }
  | { type: "declare"; card: number }
  | { type: "next"; deal: number };

const isJoker = (c: PCard, wild: number) => c.r === 0 || c.r === wild;
const points = (c: PCard, wild: number) => (isJoker(c, wild) ? 0 : c.r >= 10 ? 10 : c.r);

// Finds the arrangement with the fewest points left over. Memoised on the
// set of cards still unplaced, keeping the best result for each
// (has a pure sequence, number of sequences) combination.
export function arrange(cards: PCard[], wild: number): Arrangement {
  const n = cards.length;
  type Opt = { dead: number; pure: number; seqs: number; melds: { kind: MeldKind; cards: number[] }[]; deadIdx: number[] };
  const memo = new Map<number, Map<string, Opt>>();
  const jokerIdx = cards.flatMap((c, i) => (isJoker(c, wild) ? [i] : []));
  const keyOf = (o: Opt) => `${Math.min(1, o.pure)}${Math.min(2, o.seqs)}`;
  const keep = (map: Map<string, Opt>, o: Opt) => {
    const k = keyOf(o);
    const cur = map.get(k);
    if (!cur || o.dead < cur.dead) map.set(k, o);
  };

  const melds = (i: number, mask: number) => {
    const c = cards[i];
    const out: { kind: MeldKind; mask: number; cards: number[] }[] = [];
    const jokers = jokerIdx.filter((j) => j !== i && mask & (1 << j));
    // Sets: same rank, different suits.
    const bySuit = new Map<string, number>();
    cards.forEach((d, j) => {
      if (j !== i && mask & (1 << j) && d.r === c.r && d.s !== c.s && !bySuit.has(d.s) && (c.r === wild || !isJoker(d, wild))) bySuit.set(d.s, j);
    });
    const others = [...bySuit.values()];
    for (let pick = 0; pick < 1 << others.length; pick += 1) {
      const chosen = [i, ...others.filter((_, k) => pick & (1 << k))];
      for (let j = 0; j <= 2; j += 1) {
        const size = chosen.length + j;
        if (size < 3 || size > 4 || j > jokers.length) continue;
        const all = [...chosen, ...jokers.slice(0, j)];
        out.push({ kind: "set", mask: all.reduce((m, x) => m | (1 << x), 0), cards: all });
      }
    }
    // Sequences in c's suit (ace low or high).
    const values = c.r === 14 ? [1, 14] : [c.r];
    for (const v of values) {
      for (let start = Math.max(1, v - 12); start <= v; start += 1) {
        for (let len = Math.max(3, v - start + 1); start + len - 1 <= 14 && len <= 13; len += 1) {
          let used = 1 << i;
          let jokersUsed = 0;
          const list = [i];
          let ok = true;
          for (let r = start; r < start + len; r += 1) {
            if (r === v) continue;
            const rank = r === 1 ? 14 : r;
            const j = cards.findIndex((d, x) => !(used & (1 << x)) && mask & (1 << x) && d.s === c.s && d.r === rank);
            if (j >= 0) {
              used |= 1 << j;
              list.push(j);
            } else {
              const joker = jokers.find((x) => !(used & (1 << x)));
              if (joker === undefined) {
                ok = false;
                break;
              }
              used |= 1 << joker;
              list.push(joker);
              jokersUsed += 1;
            }
          }
          if (ok) out.push({ kind: jokersUsed ? "seq" : "pure", mask: used, cards: list });
        }
      }
    }
    return out;
  };

  const rec = (mask: number): Map<string, Opt> => {
    const hit = memo.get(mask);
    if (hit) return hit;
    const result = new Map<string, Opt>();
    let i = -1;
    for (let x = 0; x < n; x += 1) {
      if (mask & (1 << x) && !isJoker(cards[x], wild)) {
        i = x;
        break;
      }
    }
    if (i < 0) {
      result.set("00", { dead: 0, pure: 0, seqs: 0, melds: [], deadIdx: [] });
      memo.set(mask, result);
      return result;
    }
    for (const o of rec(mask & ~(1 << i)).values()) keep(result, { ...o, dead: o.dead + points(cards[i], wild), deadIdx: [...o.deadIdx, i] });
    for (const m of melds(i, mask)) {
      for (const o of rec(mask & ~m.mask).values()) {
        keep(result, {
          dead: o.dead,
          pure: o.pure + (m.kind === "pure" ? 1 : 0),
          seqs: o.seqs + (m.kind === "set" ? 0 : 1),
          melds: [...o.melds, { kind: m.kind, cards: m.cards }],
          deadIdx: o.deadIdx,
        });
      }
    }
    memo.set(mask, result);
    return result;
  };

  const all = rec((1 << n) - 1);
  const withPure = [...all.values()].filter((o) => o.pure >= 1);
  const full = all.get("12");
  const fallback: Opt = withPure.sort((a, b) => a.dead - b.dead)[0];
  const best = full && (!fallback || full.dead <= fallback.dead + 0) ? full : fallback;
  if (!best) {
    // No pure sequence: every card counts, but still show the groups found.
    const total = cards.reduce((s, c) => s + points(c, wild), 0);
    const any = [...all.values()].sort((a, b) => a.dead - b.dead)[0];
    const placed = new Set(any?.melds.flatMap((m) => m.cards) ?? []);
    return { melds: any?.melds ?? [], dead: cards.map((_, i) => i).filter((i) => !placed.has(i)), points: Math.min(MAX_POINTS, total), valid: false };
  }
  const placed = new Set(best.melds.flatMap((m) => m.cards));
  const dead = cards.map((_, i) => i).filter((i) => !placed.has(i));
  // Only full structure (2 sequences, one pure) lets sets count.
  const pointsLeft = full === best ? best.dead : dead.reduce((s, i) => s + points(cards[i], wild), 0);
  return { melds: best.melds, dead, points: Math.min(MAX_POINTS, pointsLeft), valid: full === best && best.dead === 0 };
}

function deal(prev: State, dealNo: number, starter: number): State {
  let deck = makeDeck(2, 2);
  const hands = prev.players.map(() => deck.splice(0, 13));
  let wildCard = deck.pop()!;
  while (wildCard.r === 0) {
    deck.unshift(wildCard);
    wildCard = deck.pop()!;
  }
  const first = deck.pop()!;
  deck = [...deck];
  return {
    ...prev,
    hands,
    deck,
    discard: [first],
    wild: wildCard.r,
    wildCard,
    turn: starter,
    phase: "draw",
    drewFrom: null,
    deal: dealNo,
    starter,
    shown: null,
    log: `Deal ${dealNo} of ${DEALS} — every ${rankLabel(wildCard.r)} is a joker`,
  };
}

const total = (state: State, seat: number) => state.scores.reduce((s, r) => s + (r[seat] ?? 0), 0);

function endDeal(state: State, seat: number, valid: boolean): State {
  const row = state.hands.map((h, i) => (i === seat ? (valid ? 0 : MAX_POINTS) : valid ? arrange(h, state.wild).points : 0));
  const scores = [...state.scores, row];
  const next: State = {
    ...state,
    scores,
    phase: "dealEnd",
    turn: -1,
    shown: { seat, valid },
    log: valid ? `${state.players[seat]}|made a valid show! 🎉` : `${state.players[seat]}|made a wrong show (+${MAX_POINTS})`,
  };
  if (state.deal >= DEALS) {
    const totals = state.players.map((_, i) => total(next, i));
    const low = Math.min(...totals);
    const w = totals.indexOf(low);
    return { ...next, winner: state.players[w], log: `${state.players[w]}|wins with just ${low} points! 🏆` };
  }
  return next;
}

// ---------- bot ----------

function bestDiscard(hand: PCard[], wild: number, avoid?: number) {
  let best: { card: PCard; arr: Arrangement } | null = null;
  const options = hand.filter((c) => c.id !== avoid && !isJoker(c, wild));
  for (const c of options.length ? options : hand) {
    const arr = arrange(hand.filter((x) => x.id !== c.id), wild);
    const better = !best || (arr.valid !== best.arr.valid ? arr.valid : arr.points !== best.arr.points ? arr.points < best.arr.points : arr.dead.length !== best.arr.dead.length ? arr.dead.length < best.arr.dead.length : points(c, wild) > points(best.card, wild));
    if (better) best = { card: c, arr };
  }
  return best!;
}

function botMove(state: State, seat: number): Action | null {
  const hand = state.hands[seat];
  if (state.phase === "draw") {
    const top = state.discard[state.discard.length - 1];
    if (top) {
      if (isJoker(top, state.wild)) return { type: "draw", from: "discard" };
      const now = arrange(hand, state.wild).points;
      const withTop = bestDiscard([...hand, top], state.wild, top.id).arr.points;
      const before = arrange(hand, state.wild);
      const after = bestDiscard([...hand, top], state.wild, top.id).arr;
      if (withTop + 6 <= now || (withTop === now && after.dead.length + 1 < before.dead.length)) return { type: "draw", from: "discard" };
    }
    return { type: "draw", from: "deck" };
  }
  if (state.phase !== "discard") return null;
  const taken = state.drewFrom === "discard" ? hand[hand.length - 1]?.id : undefined;
  const pick = bestDiscard(hand, state.wild, taken);
  return pick.arr.valid ? { type: "declare", card: pick.card.id } : { type: "discard", card: pick.card.id };
}

// ---------- view ----------

const MELD_LABEL: Record<MeldKind, string> = { pure: "Pure sequence", seq: "Sequence", set: "Set" };

function RummyView({ state, me, names, act, finished }: GameViewProps<State, Action>) {
  useTableSound();
  const mySeat = state.players.indexOf(me);
  const hand = state.hands[mySeat] ?? [];
  const myTurn = !finished && state.turn === mySeat;
  const [picked, setPicked] = useState<number | null>(null);
  const isHost = state.players[0] === me;
  const arr = useMemo(() => arrange(hand, state.wild), [hand, state.wild]);
  const canDeclare = useMemo(() => {
    if (!myTurn || state.phase !== "discard" || picked === null) return false;
    return arrange(hand.filter((c) => c.id !== picked), state.wild).valid;
  }, [myTurn, state.phase, picked, hand, state.wild]);
  const top = state.discard[state.discard.length - 1];

  useEffect(() => setPicked(null), [state.turn, state.deal]);
  useOnChange(state.discard.length, (prev, next) => next > prev && play("card"));
  useOnChange(hand.length, (prev, next) => next > prev && play("draw"));
  useOnChange(state.shown, (_, s) => s && play(s.seat === mySeat && s.valid ? "win" : "coin"));

  useEffect(() => {
    if (state.phase !== "dealEnd" || finished) return;
    const dealNo = state.deal;
    const timer = window.setTimeout(() => act({ type: "next", deal: dealNo }), isHost ? DEAL_MS : DEAL_MS + 4000);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.deal, finished, act, isHost]);

  const groups = [
    ...arr.melds.map((m) => ({ label: MELD_LABEL[m.kind], kind: m.kind, cards: m.cards.map((i) => hand[i]).sort((a, b) => (isJoker(a, state.wild) ? 1 : 0) - (isJoker(b, state.wild) ? 1 : 0) || a.r - b.r) })),
    ...(arr.dead.length ? [{ label: `Unmatched · ${arr.dead.reduce((s, i) => s + points(hand[i], state.wild), 0)} pts`, kind: "dead" as const, cards: arr.dead.map((i) => hand[i]).sort((a, b) => a.s.localeCompare(b.s) || a.r - b.r) }] : []),
  ];

  const others = seatOrder(state.players, me).slice(1);

  const flyRoot = useRef<HTMLDivElement>(null);
  const flyLayer = useCardFlights({ root: flyRoot, me, snapshot: { hands: Object.fromEntries(state.players.map((p, i) => [p, state.hands[i] ?? []])), pile: state.discard, round: state.deal }, renderFace: (card) => <PlayingCard card={card} small />, renderBack: () => <CardBack small />, dealLimit: 4 });

  return (
    <div className="board-game rummy-game" ref={flyRoot}>
      {flyLayer}
      <div className="opponents">
        {others.map((player) => {
          const seat = state.players.indexOf(player);
          return (
            <span key={player} className={`opponent ${state.turn === seat ? "is-turn" : ""}`} data-fly-seat={player}>
              <span className="opponent-fan">
                {state.hands[seat].slice(0, 7).map((c) => (
                  <CardBack key={c.id} tiny />
                ))}
              </span>
              <strong>{names[player]}</strong>
              <small>{total(state, seat)} pts</small>
            </span>
          );
        })}
      </div>

      <div className="table-center rummy-center">
        <div className="rummy-wild">
          <PlayingCard card={state.wildCard} small wild />
          <small>Wild joker</small>
        </div>
        <button
          type="button"
          className={`rummy-pile ${myTurn && state.phase === "draw" ? "is-ready" : ""}`}
          data-fly-deck
          disabled={!myTurn || state.phase !== "draw"}
          onClick={() => act({ type: "draw", from: "deck" })}
          aria-label="Draw from the deck"
        >
          <CardBack />
          <small>Deck · {state.deck.length}</small>
        </button>
        <button
          type="button"
          className={`rummy-pile ${myTurn && state.phase === "draw" && top ? "is-ready" : ""}`}
          data-fly-pile-spot
          data-fly-pile={top?.id}
          disabled={!myTurn || state.phase !== "draw" || !top}
          onClick={() => act({ type: "draw", from: "discard" })}
          aria-label="Take the open card"
        >
          {top ? <PlayingCard key={top.id} card={top} wild={isJoker(top, state.wild)} className="flip-in" /> : <span className="pcard pcard--slot" />}
          <small>Open card</small>
        </button>
      </div>

      <LogLine log={state.log} names={names} />

      {state.phase === "dealEnd" && (
        <div className="cb-scores">
          <strong>{finished ? "Final scores" : `After deal ${state.deal}`}</strong>
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
              {state.scores.map((r, d) => (
                <tr key={d}>
                  <td>D{d + 1}</td>
                  {r.map((v, s) => (
                    <td key={s}>{v}</td>
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

      <div className="rummy-hand">
        {groups.map((g) => (
          <div key={g.label + g.cards.map((c) => c.id).join()} className={`rummy-group rummy-group--${g.kind}`}>
            <small>{g.label}</small>
            <div>
              {g.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`hand-card ${picked === card.id ? "is-picked" : ""} ${myTurn && state.phase === "discard" ? "is-playable" : ""}`}
                  data-fly-card={card.id}
                  disabled={!myTurn || state.phase !== "discard"}
                  onClick={() => {
                    setPicked(picked === card.id ? null : card.id);
                    play("tap");
                  }}
                  aria-label={cardLabel(card)}
                >
                  <PlayingCard card={card} small wild={isJoker(card, state.wild) && card.r !== 0} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="board-actions">
        {myTurn && state.phase === "discard" ? (
          <>
            <button type="button" className="primary-btn" disabled={picked === null} onClick={() => picked !== null && act({ type: "discard", card: picked })}>
              {picked === null ? "Tap a card to discard" : "Discard"}
            </button>
            {canDeclare && (
              <button type="button" className="primary-btn is-ready rummy-declare" onClick={() => picked !== null && act({ type: "declare", card: picked })}>
                Declare 🎉
              </button>
            )}
          </>
        ) : (
          <p className="turn-label">
            {finished ? "Game over" : state.phase === "dealEnd" ? "Next deal coming…" : myTurn ? "Draw from the deck or take the open card" : `${names[state.players[state.turn]]} is thinking…`}
          </p>
        )}
      </div>
      {!arr.melds.some((m) => m.kind === "pure") && state.phase !== "dealEnd" && <p className="game-hint">Tip: you need a pure sequence (3 in a row, same suit, no joker).</p>}
    </div>
  );
}

export const rummyGame: GameDef<State, Action> = {
  id: "rummy",
  title: "Rummy",
  tagline: "13-card Indian Rummy. Sequences, sets, show!",
  emoji: "🀄",
  className: "game-card--rummy has-cover",
  minPlayers: 2,
  maxPlayers: 4,
  felt: true,
  botDelay: 1000,
  init: (players) =>
    deal(
      {
        players,
        hands: [],
        deck: [],
        discard: [],
        wild: 2,
        wildCard: { id: -1, r: 2, s: "S" },
        turn: 0,
        phase: "draw",
        drewFrom: null,
        deal: 1,
        starter: 0,
        scores: [],
        shown: null,
        log: "",
        winner: null,
      },
      1,
      0,
    ),
  apply: (state, action, by) => {
    if (state.winner) return state;
    if (action.type === "next") {
      if (state.phase !== "dealEnd" || action.deal !== state.deal) return state;
      return deal(state, state.deal + 1, (state.starter + 1) % state.players.length);
    }
    const seat = state.players.indexOf(by);
    if (seat !== state.turn) return state;
    const hand = state.hands[seat];
    if (action.type === "draw") {
      if (state.phase !== "draw") return state;
      let deck = state.deck;
      let discard = state.discard;
      let card: PCard | undefined;
      if (action.from === "discard") {
        card = discard[discard.length - 1];
        discard = discard.slice(0, -1);
      } else {
        if (deck.length === 0) {
          deck = shuffle(discard.slice(0, -1));
          discard = discard.slice(-1);
        }
        card = deck[deck.length - 1];
        deck = deck.slice(0, -1);
      }
      if (!card) return state;
      const hands = state.hands.map((h, i) => (i === seat ? [...h, card!] : h));
      return { ...state, deck, discard, hands, phase: "discard", drewFrom: action.from, log: `${by}|${action.from === "discard" ? `took the ${cardLabel(card)}` : "drew from the deck"}` };
    }
    if (state.phase !== "discard") return state;
    const card = hand.find((c) => c.id === action.card);
    if (!card) return state;
    const rest = hand.filter((c) => c.id !== card.id);
    const hands = state.hands.map((h, i) => (i === seat ? rest : h));
    const next: State = { ...state, hands, discard: [...state.discard, card], drewFrom: null };
    if (action.type === "declare") return endDeal(next, seat, arrange(rest, state.wild).valid);
    return { ...next, phase: "draw", turn: (seat + 1) % state.players.length, log: `${by}|discarded ${cardLabel(card)}` };
  },
  winner: (state) => state.winner,
  currentPlayer: (state) => (state.turn >= 0 ? state.players[state.turn] : null),
  botMove: (state, bot) => botMove(state, state.players.indexOf(bot)),
  View: RummyView,
};
