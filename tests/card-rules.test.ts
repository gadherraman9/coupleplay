import test from "node:test";
import assert from "node:assert/strict";
import { cardsGame } from "../src/games/cards";
import { callBreakGame, legalCards } from "../src/games/callbreak";
import { pokerGame } from "../src/games/poker";
import { arrange, rummyGame } from "../src/games/rummy";
import type { PCard } from "../src/games/deck";

type CardsState = ReturnType<typeof cardsGame.init>;
type PokerState = ReturnType<typeof pokerGame.init>;
type RummyState = ReturnType<typeof rummyGame.init>;
type CallBreakState = ReturnType<typeof callBreakGame.init>;
type ColorCard = CardsState["deck"][number];

function pcards(text: string, start = 0): PCard[] {
  const ranks: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11 };
  return text.split(/\s+/).map((label, i) => label === "JOKER"
    ? { id: start + i, r: 0, s: "J" }
    : { id: start + i, r: ranks[label.slice(0, -1)] ?? Number(label.slice(0, -1)), s: label.slice(-1) as PCard["s"] });
}

// Fixed rotations, reversals and seeded shuffles; never depend on Math.random.
function orders<T>(items: T[]) {
  const result = items.flatMap((_, i) => {
    const rotated = [...items.slice(i), ...items.slice(0, i)];
    return [rotated, [...rotated].reverse()];
  });
  let seed = 12345;
  for (let run = 0; run < 12; run += 1) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    result.push(copy);
  }
  return result;
}

function assertCovered(hand: PCard[], arr: ReturnType<typeof arrange>) {
  const indices = [...arr.melds.flatMap((m) => m.cards), ...arr.dead];
  assert.deepEqual(indices.sort((a, b) => a - b), hand.map((_, i) => i), "each physical card is used exactly once");
}

const declaration = "2H 3H 7S 6S 8S 10S 10H 10D KS KH KD KC JOKER";

function rummyTable(hand = pcards(`${declaration} 9C`)): RummyState {
  return {
    players: ["A", "B"], hands: [hand, pcards(declaration, 100)], deck: [],
    discard: pcards("5D", 200), wild: 7, wildCard: pcards("7C", 201)[0],
    turn: 0, phase: "discard", drewFrom: "deck", deal: 1, starter: 0,
    scores: [], shown: null, log: "", winner: null,
  };
}

test("Rummy declaration is permutation-invariant and reserves a natural wild for its pure sequence", () => {
  const original = pcards(`${declaration} 9C`);
  for (const hand of orders(original)) {
    const state = rummyTable(hand);
    const before = structuredClone(state);
    const rest = hand.filter((c) => c.id !== 13);
    const arr = arrange(rest, 7);
    assert.equal(arr.valid, true);
    assert.equal(arr.points, 0);
    assertCovered(rest, arr);
    assert.ok(arr.melds.some((m) => m.kind === "pure" && m.cards.some((i) => rest[i].r === 7 && rest[i].s === "S")));
    const ended = rummyGame.apply(state, { type: "declare", card: 13 }, "A");
    assert.deepEqual(ended.shown, { seat: 0, valid: true });
    assert.equal(ended.phase, "dealEnd");
    assert.equal(ended.discard.at(-1)?.id, 13);
    assert.deepEqual(ended.scores, [[0, 0]]);
    assert.deepEqual(state, before, "declaration does not mutate its input");
  }
});

test("Rummy enumerates joker assignments in sets as well as sequences", () => {
  const hand = pcards("2H 2D 7S 6S 8S 10H JH QH KS KH KD KC JOKER");
  for (const order of orders(hand)) {
    const arr = arrange(order, 7);
    assert.equal(arr.valid, true);
    assertCovered(order, arr);
    assert.ok(arr.melds.some((m) => m.kind === "set" && m.cards.some((i) => order[i].r === 0 || order[i].r === 7)));
  }
});

test("Rummy keeps duplicate deck cards distinct across melds", () => {
  const hand = pcards("3H 4H 5H 3H 3S 3D 8C 9C 10C KS KH KD KC");
  for (const order of orders(hand)) {
    const arr = arrange(order, 7);
    assert.equal(arr.valid, true);
    assertCovered(order, arr);
  }
});

test("Rummy penalizes sets when a second sequence is missing", () => {
  const hand = pcards("2H 3H 4H 7S 7H 7D 9S 9H 9D KS KH KD AC");
  for (const order of orders(hand)) {
    const arr = arrange(order, 12);
    assert.equal(arr.valid, false);
    assert.equal(arr.points, 80);
    assertCovered(order, arr);
  }
  const state = rummyTable(pcards("2H 3H 4H 5S 6S 7S 9S 9H 9D KS KH KD KC 2C", 100));
  state.hands[1] = hand;
  state.wild = 12;
  const ended = rummyGame.apply(state, { type: "declare", card: 113 }, "A");
  assert.deepEqual(ended.shown, { seat: 0, valid: true });
  assert.deepEqual(ended.scores, [[0, 80]]);
});

test("Rummy minimizes true eligible penalty rather than unmatched points after sets", () => {
  const hand = pcards("2H 3H 4H 5H 2S 2D 5S 5D 9S 9H 9D KC AC");
  for (const order of orders(hand)) {
    const arr = arrange(order, 12);
    assert.equal(arr.points, 61); // All four hearts protect 14 points; sets protect none.
    assert.equal(arr.valid, false);
    assertCovered(order, arr);
  }
});

test("Rummy exempts sets with two sequences and searches beyond the longest pure run", () => {
  const incomplete = arrange(pcards("2H 3H 4H 5S 6S 7S 9S 9H 9D KS KH KD AC"), 12);
  assert.equal(incomplete.points, 10);
  assert.equal(incomplete.valid, false);
  const hand = pcards("2H 3H 4H 5H 6H 6S 6D 8S 9S JOKER KC KH KD");
  const complete = arrange(hand, 12);
  assert.equal(complete.valid, true);
  assert.equal(complete.points, 0);
  assertCovered(hand, complete);
});

test("Rummy allows ace-low/high and natural wild sequences but not ace wrapping", () => {
  for (const text of ["AH 2H 3H", "QH KH AH", "6S 7S 8S"]) {
    const arr = arrange(pcards(text), 7);
    assert.equal(arr.melds[0]?.kind, "pure");
    assert.equal(arr.points, 0);
    assert.equal(arr.valid, false, "one sequence alone is not a valid show");
  }
  const wrapped = arrange(pcards("KH AH 2H"), 7);
  assert.equal(wrapped.points, 22);
  assert.equal(wrapped.melds.some((m) => m.kind === "pure"), false);
  const impure = arrange(pcards("2H 3H JOKER"), 7);
  assert.equal(impure.points, 5, "without a pure sequence every non-joker counts");
});

function pokerTable(stacks = [1000, 1000, 1000]): PokerState {
  const players = stacks.map((_, i) => String.fromCharCode(65 + i));
  const deck = ["S", "H", "D", "C"].flatMap((s) => pcards(`2${s} 3${s} 4${s} 5${s} 6${s} 7${s} 8${s} 9${s} 10${s} J${s} Q${s} K${s} A${s}`));
  deck.forEach((c, i) => { c.id = i; });
  const seats = stacks.map((chips, i) => {
    const bet = i === stacks.length - 2 ? 10 : i === stacks.length - 1 ? 20 : 0;
    return { chips: chips - bet, bet, total: bet, folded: false, allIn: chips === bet, out: false, cards: deck.splice(0, 2) };
  });
  return {
    players, seats, deck, board: [], dealer: (stacks.length - 3 + stacks.length) % stacks.length,
    turn: 0, street: "preflop", toAct: players.map((_, i) => i), lastActedBet: players.map(() => null),
    currentBet: 20, minRaise: 20, hand: 1, blinds: [10, 20], results: null,
    reveal: false, said: {}, log: "", winner: null,
  };
}

function shortAllIn(stacks = [1000, 1000, 150]) {
  let state = pokerTable(stacks);
  state = pokerGame.apply(state, { type: "raise", to: 100 }, "A");
  state = pokerGame.apply(state, { type: "call" }, "B");
  return pokerGame.apply(state, { type: "raise", to: 150 }, "C");
}

test("Poker short all-in requires responses without reopening previous raise rights", () => {
  const state = shortAllIn();
  const before = structuredClone(state);
  assert.equal(state.currentBet, 150);
  assert.equal(state.minRaise, 80);
  assert.deepEqual(state.toAct, [0, 1]);
  assert.equal(pokerGame.apply(state, { type: "raise", to: 230 }, "A"), state);
  assert.equal(pokerGame.apply(state, { type: "raise", to: 1000 }, "A"), state);
  const called = pokerGame.apply(state, { type: "call" }, "A");
  assert.equal(called.seats[0].bet, 150);
  assert.equal(called.turn, 1);
  assert.equal(called.street, "preflop");
  assert.equal(pokerGame.apply(called, { type: "raise", to: 230 }, "B"), called);
  const flop = pokerGame.apply(called, { type: "call" }, "B");
  assert.equal(flop.street, "flop");
  assert.deepEqual(flop.lastActedBet, [null, null, null]);
  assert.equal(flop.seats.reduce((sum, s) => sum + s.chips + s.total, 0), 2150);
  const bet = pokerGame.apply(flop, { type: "raise", to: 20 }, flop.players[flop.turn]);
  assert.notEqual(bet, flop, "raise rights reset on the next street");
  assert.deepEqual(state, before);
});

test("Poker bots do not propose a raise when a short all-in has not reopened action", (t) => {
  const state = shortAllIn();
  state.seats[0].cards = pcards("AH AS", 100);
  t.mock.method(Math, "random", () => 0);
  assert.deepEqual(pokerGame.botMove!(state, "A"), { type: "call" });
});

test("Poker short all-ins leave unacted players free to make a full raise", () => {
  const state = shortAllIn([1000, 1000, 150, 1000]);
  assert.equal(state.turn, 3);
  const raised = pokerGame.apply(state, { type: "raise", to: 230 }, "D");
  assert.equal(raised.currentBet, 230);
  assert.equal(raised.minRaise, 80);
  assert.equal(pokerGame.apply(raised, { type: "raise", to: 310 }, "A").currentBet, 310);
});

for (const lastAllIn of [179, 180]) {
  test(`Poker cumulative short all-ins ${lastAllIn === 180 ? "do" : "do not"} reach the full-raise threshold`, () => {
    let state = shortAllIn([1000, 1000, 150, lastAllIn]);
    state = pokerGame.apply(state, { type: "raise", to: lastAllIn }, "D");
    assert.equal(state.turn, 0);
    assert.equal(state.minRaise, 80);
    const raised = pokerGame.apply(state, { type: "raise", to: lastAllIn + 80 }, "A");
    if (lastAllIn === 179) assert.equal(raised, state);
    else assert.equal(raised.currentBet, 260);
  });
}

test("Poker cumulative reopening is measured from each player's own last response", () => {
  let state = shortAllIn([1000, 1000, 150, 1000, 180]);
  state = pokerGame.apply(state, { type: "call" }, "D");
  state = pokerGame.apply(state, { type: "raise", to: 180 }, "E");
  assert.equal(pokerGame.apply(state, { type: "raise", to: 260 }, "A").currentBet, 260);
  state = pokerGame.apply(state, { type: "call" }, "A");
  state = pokerGame.apply(state, { type: "call" }, "B");
  assert.equal(state.turn, 3);
  assert.equal(state.lastActedBet[3], 150);
  assert.equal(pokerGame.apply(state, { type: "raise", to: 260 }, "D"), state);
  assert.equal(pokerGame.apply(state, { type: "call" }, "D").street, "flop");
});

test("Poker rejects non-all-in underraises and still allows folding to a short all-in", () => {
  let state = pokerTable();
  state = pokerGame.apply(state, { type: "raise", to: 100 }, "A");
  assert.equal(pokerGame.apply(state, { type: "raise", to: 150 }, "B"), state);
  const short = shortAllIn();
  const folded = pokerGame.apply(short, { type: "fold" }, "A");
  assert.equal(folded.seats[0].folded, true);
  assert.equal(folded.turn, 1);
});

function riverFinish(chips = [900, 900, 900], hand = 15) {
  let state = pokerTable();
  state.hand = hand;
  state.street = "river";
  state.board = pcards("10H JH QH KH AH", 100);
  state.currentBet = 0;
  state.seats.forEach((seat, i) => { seat.chips = chips[i]; seat.bet = 0; seat.total = 100; });
  for (const by of state.players) state = pokerGame.apply(state, { type: "check" }, by);
  return state;
}

test("Poker final tournament ties are draws, including a tied subset of leaders", () => {
  for (const chips of [[900, 900, 900], [1000, 1000, 700]]) {
    const state = riverFinish(chips);
    assert.equal(pokerGame.winner(state), "draw");
    assert.match(state.log, /draw/i);
    assert.match(state.log, /@\[A\].*@\[B\].*tied/);
    assert.equal(state.results?.reduce((sum, r) => sum + r.amount, 0), 300);
  }
  assert.equal(pokerGame.winner(riverFinish([1100, 900, 700])), "A");
  assert.equal(pokerGame.winner(riverFinish([900, 900, 900], 14)), null);
});

test("Rummy final tied totals draw; a unique lowest score still wins", () => {
  for (const previous of [80, 40]) {
    const state = rummyTable(pcards("2H 4S 6D 8C 10H QS AD 2C 4H 6S 8D 10C KH 5D"));
    state.deal = 3;
    state.scores = [[0, previous / 2], [0, previous / 2]];
    const ended = rummyGame.apply(state, { type: "declare", card: 13 }, "A");
    assert.deepEqual(ended.shown, { seat: 0, valid: false });
    assert.equal(rummyGame.winner(ended), previous === 80 ? "draw" : "B");
    if (previous === 80) {
      assert.match(ended.log, /Draw.*@\[A\].*@\[B\].*80/);
      assert.equal(rummyGame.apply(ended, { type: "next", deal: 3 }, "A"), ended);
    }
  }
});

test("Call Break requires a lower trump when void in the led suit and unable to overtrump", () => {
  const trick = pcards("AH AS", 100).map((card, seat) => ({ seat, card }));
  const hand = pcards("2S 2D");
  assert.deepEqual(legalCards(hand, trick), [hand[0]]);
  const state: CallBreakState = {
    players: ["A", "B", "C", "D"], hands: [[], [], hand, pcards("3D", 200)],
    phase: "play", bids: [1, 1, 1, 1], tricks: [0, 0, 0, 0], trick,
    lastTrick: null, played: [], turn: 2, dealer: 3, round: 1, scores: [], log: "", winner: null,
  };
  assert.equal(callBreakGame.apply(state, { type: "play", card: hand[1].id }, "C"), state);
  assert.equal(callBreakGame.botMove!(state, "C")?.type, "play");
  assert.deepEqual(callBreakGame.botMove!(state, "C"), { type: "play", card: hand[0].id });
  const played = callBreakGame.apply(state, { type: "play", card: hand[0].id }, "C");
  assert.equal(played.trick.at(-1)?.card.id, hand[0].id);
});

test("Call Break still follows suit, overtrumps when possible, and discards only without trump", () => {
  const trick = pcards("AH 9S", 100).map((card, seat) => ({ seat, card }));
  assert.deepEqual(legalCards(pcards("2H 2S 2D"), trick).map((c) => c.s), ["H"]);
  assert.deepEqual(legalCards(pcards("2S JS 2D"), trick).map((c) => c.r), [11]);
  const hand = pcards("2D 3C");
  assert.deepEqual(legalCards(hand, trick), hand);
});

test("Call Break final tied leaders draw and unique leaders still win", () => {
  for (const bonus of [0, 1]) {
    const hand = pcards("2H", 200);
    const state: CallBreakState = {
      players: ["A", "B", "C", "D"], hands: [[], [], [], hand], phase: "play",
      bids: [4, 3, 3, 3], tricks: [3, 3, 3, 3],
      trick: pcards("AH KH QH", 100).map((card, seat) => ({ seat, card })),
      lastTrick: null, played: [], turn: 3, dealer: 3, round: 5,
      scores: [[0, bonus, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], log: "", winner: null,
    };
    const ended = callBreakGame.apply(state, { type: "play", card: hand[0].id }, "D");
    assert.deepEqual(ended.scores.at(-1), [4, 3, 3, 3]);
    assert.equal(callBreakGame.winner(ended), bonus ? "draw" : "A");
    if (bonus) {
      assert.match(ended.log, /Draw.*@\[A\].*@\[B\].*4 points/);
      assert.equal(callBreakGame.apply(ended, { type: "next", round: 5 }, "A"), ended);
    }
  }
});

const colorCard = (id: number, color: ColorCard["color"], value: ColorCard["value"]): ColorCard => ({ id, color, value });
function colorTable(): CardsState {
  return {
    players: ["A", "B", "C"],
    hands: { A: [colorCard(1, "red", "2"), colorCard(2, "blue", "3")], B: [colorCard(3, "green", "2")], C: [colorCard(4, "yellow", "4")] },
    deck: [colorCard(5, "blue", "7"), colorCard(6, "red", "9")], discard: [colorCard(0, "red", "5")],
    color: "red", turn: 0, direction: 1, drew: false, drawnCard: null, log: "", winner: null,
  };
}

function colorIds(state: CardsState) {
  return [...state.deck, ...state.discard, ...Object.values(state.hands).flat()].map((c) => c.id).sort((a, b) => a - b);
}

test("Color Cards drawn phase permits only the newly drawn matching card", () => {
  const state = colorTable();
  assert.equal(cardsGame.apply(state, { type: "pass" }, "A"), state);
  const drawn = cardsGame.apply(state, { type: "draw" }, "A");
  assert.equal(drawn.drawnCard, 6);
  assert.equal(cardsGame.apply(drawn, { type: "draw" }, "A"), drawn);
  assert.equal(cardsGame.apply(drawn, { type: "play", card: 1 }, "A"), drawn);
  assert.equal(cardsGame.botMove!(drawn, "A")?.type, "play");
  assert.equal((cardsGame.botMove!(drawn, "A") as { card: number }).card, 6);
  const played = cardsGame.apply(drawn, { type: "play", card: 6 }, "A");
  assert.equal(played.discard.at(-1)?.id, 6);
  assert.equal(played.turn, 1);
  assert.equal(played.drew, false);
  assert.equal(played.drawnCard, null);
  assert.deepEqual(colorIds(played), colorIds(state));
});

test("Color Cards must pass an unplayable draw even when an older matching card exists", () => {
  const state = colorTable();
  state.deck = [colorCard(6, "blue", "9")];
  const drawn = cardsGame.apply(state, { type: "draw" }, "A");
  assert.equal(cardsGame.apply(drawn, { type: "play", card: 6 }, "A"), drawn);
  assert.equal(cardsGame.apply(drawn, { type: "play", card: 1 }, "A"), drawn);
  assert.deepEqual(cardsGame.botMove!(drawn, "A"), { type: "pass" });
  const passed = cardsGame.apply(drawn, { type: "pass" }, "A");
  assert.equal(passed.turn, 1);
  assert.equal(passed.drew, false);
  assert.equal(passed.drawnCard, null);
});

test("Color Cards can play a newly drawn wild or pass without playing it", () => {
  const state = colorTable();
  state.deck = [colorCard(6, "wild", "wild")];
  const drawn = cardsGame.apply(state, { type: "draw" }, "A");
  const played = cardsGame.apply(drawn, { type: "play", card: 6, color: "green" }, "A");
  assert.equal(played.color, "green");
  assert.equal(played.discard.at(-1)?.id, 6);
  assert.equal(cardsGame.apply(drawn, { type: "pass" }, "A").hands.A.length, 3);
});

for (const value of ["draw2", "wild4"] as const) {
  test(`Color Cards final ${value} resolves the next player's penalty before winning`, () => {
    const state = colorTable();
    state.hands.A = [colorCard(1, value === "wild4" ? "wild" : "red", value)];
    state.direction = value === "wild4" ? -1 : 1;
    state.deck = [colorCard(5, "blue", "7")];
    state.discard = [colorCard(7, "green", "5"), colorCard(8, "yellow", "5"), colorCard(0, "red", "5")];
    const before = structuredClone(state);
    const ended = cardsGame.apply(state, { type: "play", card: 1, color: "blue" }, "A");
    const victim = value === "wild4" ? "C" : "B";
    const count = value === "wild4" ? 4 : 2;
    assert.equal(cardsGame.winner(ended), "A");
    assert.equal(ended.hands.A.length, 0);
    assert.equal(ended.hands[victim].length, 1 + count);
    assert.equal(ended.hands[victim === "B" ? "C" : "B"].length, 1);
    assert.equal(ended.discard.at(-1)?.id, 1, "the final card remains atop the recycled discard pile");
    assert.match(ended.log, new RegExp(`@\\[${victim}\\] drew ${count} cards`));
    assert.deepEqual(colorIds(ended), colorIds(state));
    assert.deepEqual(state, before);
    assert.equal(cardsGame.apply(ended, { type: "draw" }, victim), ended);
  });
}
