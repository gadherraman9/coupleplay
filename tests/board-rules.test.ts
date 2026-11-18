import assert from "node:assert/strict";
import test from "node:test";
import type { DB, GameSession, User } from "../src/backend/types";
import { finalizeGameUpdate, recordGameProgress } from "../src/coupleProgress";
import { COMPLETION_HEARTS, XP_PLAY } from "../src/progress";
import { bounceGame } from "../src/games/bounce";
import { checkersGame } from "../src/games/checkers";
import { dotsGame } from "../src/games/dots";
import { fourInRowGame } from "../src/games/fourinrow";
import { ludoGame } from "../src/games/ludo";
import { snakesGame } from "../src/games/snakes";
import { ticTacToeGame } from "../src/games/tictactoe";
import { tycoonGame } from "../src/games/tycoon";
import type { GameDef } from "../src/games/types";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

// Every exercised reducer must leave its input (including nested arrays) intact.
function step<S, A>(game: GameDef<S, A>, state: S, action: A, by = "A"): S {
  const before = structuredClone(state);
  const next = game.apply(freeze(state), action, by);
  assert.deepEqual(state, before, `${game.id}: input is immutable`);
  return next;
}

// Unknown payloads deliberately exercise runtime validation, not TS's action union.
function noOp<S, A>(game: GameDef<S, A>, state: S, action: unknown, by = "A") {
  assert.strictEqual(step(game, state, action as A, by), state, `${game.id}: rejected action must return the original state`);
}

// All callbacks below are synchronous; node:test runs these tests serially.
// Exhaustion catches accidental extra rolls, and finally restores RNG on failure.
function withRandom<T>(values: number[], run: () => T): T {
  const original = Math.random;
  let used = 0;
  Math.random = () => {
    assert.ok(used < values.length, "unexpected random draw");
    return values[used++];
  };
  try {
    const result = run();
    assert.equal(used, values.length, "all pinned random draws were used");
    return result;
  } finally {
    Math.random = original;
  }
}

const withRolls = <T>(dice: number[], run: () => T) => withRandom(dice.map((d) => (d - 0.5) / 6), run);

test("Ludo initializes independent tokens and progresses through no-move, six and ordinary turns", () => {
  for (const [players, seats] of [
    [["A", "B"], [0, 2]], [["A", "B", "C"], [0, 1, 2]], [["A", "B", "C", "D"], [0, 1, 2, 3]],
  ] as [string[], number[]][]) {
    const initial = ludoGame.init(players);
    assert.deepEqual(initial.seats, seats);
    assert.deepEqual(initial.tokens.A, [-1, -1, -1, -1]);
    assert.notStrictEqual(initial.tokens.A, initial.tokens.B);
  }
  let state = ludoGame.init(["A", "B"]);
  state = withRolls([2], () => step(ludoGame, state, { type: "roll" }));
  assert.equal(state.phase, "roll");
  assert.equal(ludoGame.currentPlayer!(state), "B");
  state = withRolls([6], () => step(ludoGame, state, { type: "roll" }, "B"));
  assert.equal(state.phase, "move");
  state = step(ludoGame, state, { type: "move", token: 0 }, "B");
  assert.deepEqual(state.tokens.B, [0, -1, -1, -1]);
  assert.equal(state.turn, 1, "a six earns another roll");
  state = withRolls([2], () => step(ludoGame, state, { type: "roll" }, "B"));
  state = step(ludoGame, state, { type: "move", token: 0 }, "B");
  assert.equal(state.tokens.B[0], 2);
  assert.equal(state.turn, 0);
  assert.equal(state.rollNo, 3);
  assert.equal(ludoGame.winner(state), null);
});

test("Ludo rejects wrong players, wrong phases, invalid tokens and overshoots", () => {
  const initial = ludoGame.init(["A", "B"]);
  withRandom([], () => {
    for (const by of ["B", "outsider"]) noOp(ludoGame, initial, { type: "roll" }, by);
    noOp(ludoGame, initial, { type: "move", token: 0 });
  });
  const ready = { ...initial, phase: "move" as const, dice: 2, tokens: { A: [55, 56, -1, 10], B: [-1, -1, -1, -1] } };
  withRandom([], () => noOp(ludoGame, ready, { type: "roll" }));
  for (const token of [-1, 4, 0.5, NaN, Infinity, 0, 1, 2]) noOp(ludoGame, ready, { type: "move", token });
  noOp(ludoGame, ready, { type: "move", token: 3 }, "B");
});

test("Ludo captures on shared track coordinates but protects safe squares and home lanes", () => {
  const initial = ludoGame.init(["A", "B"]);
  const ready = { ...initial, phase: "move" as const, dice: 1, tokens: { A: [4, -1, -1, -1], B: [31, 31, -1, -1] } };
  const captured = step(ludoGame, ready, { type: "move", token: 0 });
  assert.deepEqual(captured.tokens.B, [-1, -1, -1, -1]);
  assert.deepEqual(captured.capture, { by: "A", token: 0, n: 1 });
  assert.equal(captured.turn, 0, "capture grants an extra roll without a six");
  const safe = step(ludoGame, { ...ready, tokens: { A: [7, -1, -1, -1], B: [34, -1, -1, -1] } }, { type: "move", token: 0 });
  assert.equal(safe.tokens.B[0], 34);
  assert.equal(safe.capture, undefined);
  assert.equal(safe.turn, 1);
  const home = step(ludoGame, { ...ready, tokens: { A: [24, -1, -1, -1], B: [51, -1, -1, -1] } }, { type: "move", token: 0 });
  assert.equal(home.tokens.B[0], 51, "home-lane tokens cannot be captured via modulo coordinates");
});

test("Ludo requires exact home arrival, grants a home bonus and locks the fourth-token win", () => {
  const initial = ludoGame.init(["A", "B"]);
  const home = step(ludoGame, { ...initial, phase: "move", dice: 1, tokens: { ...initial.tokens, A: [55, -1, -1, -1] } }, { type: "move", token: 0 });
  assert.equal(home.tokens.A[0], 56);
  assert.equal(home.turn, 0);
  assert.equal(home.winner, null);
  const won = step(ludoGame, { ...home, phase: "move", dice: 1, tokens: { ...home.tokens, A: [56, 56, 56, 55] } }, { type: "move", token: 3 });
  assert.equal(ludoGame.winner(won), "A");
  assert.deepEqual(won.tokens.A, [56, 56, 56, 56]);
  withRandom([], () => noOp(ludoGame, won, { type: "roll" }));
  noOp(ludoGame, won, { type: "move", token: 3 });
});

test("Ludo rejects an unknown action even when it supplies a legal token", () => {
  const state = { ...ludoGame.init(["A", "B"]), phase: "move" as const, dice: 6 };
  noOp(ludoGame, state, { type: "invalid", token: 0 });
});

test("Snakes follows the initialized layout and records pre-jump ladder/snake landings", () => {
  const classic = snakesGame.init(["A", "B"]);
  assert.equal(classic.layout, "classic");
  const ladder = withRolls([4], () => step(snakesGame, classic, { type: "roll" }));
  assert.equal(ladder.positions.A, 25);
  assert.deepEqual(ladder.lastMove, { player: "A", landed: 4 });
  assert.equal(snakesGame.currentPlayer!(ladder), "B");
  const snake = withRolls([2], () => step(snakesGame, { ...ladder, turn: 0 }, { type: "roll" }));
  assert.equal(snake.positions.A, 5);
  assert.deepEqual(snake.lastMove, { player: "A", landed: 27 });
  assert.equal(snake.rollNo, 2);
  const jungle = snakesGame.init(["A", "B"], { skins: { snakes: "snakes-jungle" } });
  assert.equal(jungle.layout, "jungle");
  assert.equal(withRolls([3], () => step(snakesGame, jungle, { type: "roll" })).positions.A, 22);
});

test("Snakes gives a six another turn and requires an exact roll to win", () => {
  const initial = snakesGame.init(["A", "B"]);
  const six = withRolls([6], () => step(snakesGame, initial, { type: "roll" }));
  assert.equal(six.positions.A, 6);
  assert.equal(six.turn, 0);
  const near = { ...initial, positions: { A: 98, B: 20 } };
  const overshoot = withRolls([3], () => step(snakesGame, near, { type: "roll" }));
  assert.deepEqual(overshoot.positions, near.positions);
  assert.equal(overshoot.turn, 1);
  assert.deepEqual(overshoot.lastMove, { player: "A", landed: 98 });
  const won = withRolls([2], () => step(snakesGame, near, { type: "roll" }));
  assert.equal(won.positions.A, 100);
  assert.equal(snakesGame.winner(won), "A");
  withRandom([], () => noOp(snakesGame, won, { type: "roll" }));
});

test("Snakes rejects wrong-player and invalid actions without consuming randomness", () => {
  const state = snakesGame.init(["A", "B"]);
  withRandom([], () => {
    for (const by of ["B", "outsider"]) noOp(snakesGame, state, { type: "roll" }, by);
    noOp(snakesGame, state, { type: "move" });
    noOp(snakesGame, state, {});
  });
});

function drops(columns: number[]) {
  let state = fourInRowGame.init(["A", "B"]);
  for (const col of columns) {
    assert.equal(state.winner, null, "fixture must not continue an already-won game");
    state = step(fourInRowGame, state, { type: "drop", col }, state.players[state.turn]);
  }
  return state;
}

test("Four in a Row stacks discs by gravity, alternates turns and rejects a full column", () => {
  const state = drops([0, 0, 0, 0, 0, 0]);
  assert.deepEqual([0, 7, 14, 21, 28, 35].map((i) => state.board[i]), [1, 0, 1, 0, 1, 0]);
  assert.equal(state.lastDrop, 0);
  assert.equal(fourInRowGame.currentPlayer!(state), "A");
  noOp(fourInRowGame, state, { type: "drop", col: 0 });
  for (const by of ["B", "outsider"]) noOp(fourInRowGame, state, { type: "drop", col: 1 }, by);
  noOp(fourInRowGame, state, { type: "next", round: 1 });
});

for (const [direction, columns] of [
  ["horizontal", [0, 0, 1, 1, 2, 2, 3]],
  ["vertical", [0, 1, 0, 1, 0, 1, 0]],
  ["rising diagonal", [0, 1, 1, 2, 4, 2, 2, 3, 4, 3, 5, 3, 3]],
  ["falling diagonal", [6, 5, 5, 4, 2, 4, 4, 3, 2, 3, 1, 3, 3]],
] as [string, number[]][]) {
  test(`Four in a Row detects a ${direction} win and rejects post-win actions`, () => {
    const won = drops(columns);
    assert.equal(fourInRowGame.winner(won), "A");
    assert.equal(won.drawn, false);
    assert.equal(won.line!.length, 4);
    assert.ok(won.line!.every((i) => won.board[i] === 0));
    noOp(fourInRowGame, won, { type: "drop", col: 6 });
    noOp(fourInRowGame, won, { type: "next", round: won.round });
  });
}

function fourDraw() {
  // No four-in-a-row in any direction. B fills the sole vacancy (21 A, 20 B).
  const board: (number | null)[] = ["0011001", "1100110", "0011001", "1100110", "0011001", "1100110"].join("").split("").map(Number);
  board[2] = null;
  return step(fourInRowGame, { ...fourInRowGame.init(["A", "B"]), board, turn: 1 }, { type: "drop", col: 2 }, "B");
}

test("Four in a Row draws on a full board and advances only the matching round once", () => {
  const drawn = fourDraw();
  assert.equal(drawn.drawn, true);
  assert.equal(fourInRowGame.winner(drawn), null);
  assert.equal(fourInRowGame.currentPlayer!(drawn), null);
  assert.ok(drawn.board.every((c) => c !== null));
  noOp(fourInRowGame, drawn, { type: "drop", col: 2 }, "B");
  noOp(fourInRowGame, drawn, { type: "next", round: 0 });
  const next = step(fourInRowGame, drawn, { type: "next", round: drawn.round });
  assert.equal(next.round, 2);
  assert.equal(next.turn, 0);
  assert.equal(next.drawn, false);
  assert.equal(next.lastDrop, null);
  assert.equal(next.line, null);
  assert.deepEqual(next.board, Array(42).fill(null));
  noOp(fourInRowGame, next, { type: "next", round: drawn.round }, "B");
});

test("Four in a Row rejects out-of-range/noninteger columns rather than wrapping rows", () => {
  const state = fourInRowGame.init(["A", "B"]);
  for (const col of [-1, 7, 42, 0.5, NaN, Infinity]) noOp(fourInRowGame, state, { type: "drop", col });
});

test("Four in a Row rejects unknown action types with an otherwise legal column", () => {
  noOp(fourInRowGame, fourInRowGame.init(["A", "B"]), { type: "invalid", col: 0 });
});

test("Four in a Row does not let a nonparticipant reset a drawn round", () => {
  const drawn = fourDraw();
  noOp(fourInRowGame, drawn, { type: "next", round: drawn.round }, "outsider");
});

type CheckersState = ReturnType<typeof checkersGame.init>;
function checkersBoard(pieces: [number, number, boolean][]): CheckersState["board"] {
  const board: CheckersState["board"] = Array(64).fill(null);
  for (const [at, o, k] of pieces) board[at] = { o, k };
  return board;
}

test("Checkers starts with twelve pieces each, moves diagonally and rejects illegal moves", () => {
  const initial = checkersGame.init(["A", "B"]);
  assert.equal(initial.board.filter((p) => p?.o === 0).length, 12);
  assert.equal(initial.board.filter((p) => p?.o === 1).length, 12);
  for (const by of ["B", "outsider"]) noOp(checkersGame, initial, { type: "move", from: 40, to: 33 }, by);
  for (const [from, to] of [[40, 32], [40, 49], [40, 40], [-1, 33], [40, 64], [40, 33.5], [17, 26]]) {
    noOp(checkersGame, initial, { type: "move", from, to });
  }
  const moved = step(checkersGame, initial, { type: "move", from: 40, to: 33 });
  assert.equal(moved.board[40], null);
  assert.deepEqual(moved.board[33], { o: 0, k: false });
  assert.deepEqual(moved.last, { from: 40, to: 33, captured: null });
  assert.equal(moved.moves, 1);
  assert.equal(moved.quiet, 1);
  assert.equal(checkersGame.currentPlayer!(moved), "B");
});

test("Checkers forces captures and same-piece chained jumps, then wins on elimination", () => {
  const initial = { ...checkersGame.init(["A", "B"]), quiet: 12, board: checkersBoard([[40, 0, false], [44, 0, false], [33, 1, false], [19, 1, false]]) };
  noOp(checkersGame, initial, { type: "move", from: 44, to: 35 });
  const jump = step(checkersGame, initial, { type: "move", from: 40, to: 26 });
  assert.equal(jump.board[33], null);
  assert.equal(jump.chain, 26);
  assert.equal(jump.turn, 0);
  assert.equal(jump.quiet, 0);
  noOp(checkersGame, jump, { type: "move", from: 44, to: 35 });
  noOp(checkersGame, jump, { type: "move", from: 26, to: 17 });
  noOp(checkersGame, jump, { type: "move", from: 19, to: 28 }, "B");
  const won = step(checkersGame, jump, { type: "move", from: 26, to: 12 });
  assert.equal(won.chain, null);
  assert.equal(won.moves, 2);
  assert.equal(won.board.filter((p) => p?.o === 1).length, 0);
  assert.equal(checkersGame.winner(won), "A");
  noOp(checkersGame, won, { type: "move", from: 12, to: 3 });
});

test("Checkers stops a capture chain when a man is crowned instead of jumping backward immediately", () => {
  const initial = { ...checkersGame.init(["A", "B"]), board: checkersBoard([[17, 0, false], [10, 1, false], [12, 1, false]]) };
  const crowned = step(checkersGame, initial, { type: "move", from: 17, to: 3 });
  assert.deepEqual(crowned.board[3], { o: 0, k: true });
  assert.equal(crowned.board[10], null);
  assert.deepEqual(crowned.board[12], { o: 1, k: false });
  assert.equal(crowned.chain, null);
  assert.equal(crowned.turn, 1);
  assert.equal(crowned.winner, null);
  noOp(checkersGame, crowned, { type: "move", from: 3, to: 21 });
});

test("Checkers resolves the quiet-move limit by material or resets an equal board", () => {
  const initial = { ...checkersGame.init(["A", "B"]), quiet: 59, board: checkersBoard([[40, 0, true], [7, 1, false]]) };
  const won = step(checkersGame, initial, { type: "move", from: 40, to: 33 });
  assert.equal(checkersGame.winner(won), "A", "a king outweighs a man");
  const equal = step(checkersGame, { ...initial, board: checkersBoard([[40, 0, true], [7, 1, true]]) }, { type: "move", from: 40, to: 33 });
  assert.equal(equal.winner, null);
  assert.equal(equal.quiet, 0);
  assert.equal(equal.turn, 0);
  assert.equal(equal.last, null);
  assert.deepEqual(equal.board, checkersGame.init(["A", "B"]).board);
});

test("Checkers rejects an unknown action even with a legal from/to pair", () => {
  noOp(checkersGame, checkersGame.init(["A", "B"]), { type: "invalid", from: 40, to: 33 });
});

test("Tycoon rolls, buys a city exactly once and advances to the next player's roll", () => {
  const initial = tycoonGame.init(["A", "B"]);
  assert.deepEqual(initial.money, { A: 1500, B: 1500 });
  const landed = withRolls([1, 2], () => step(tycoonGame, initial, { type: "roll" }));
  assert.deepEqual(landed.dice, [1, 2]);
  assert.equal(landed.position.A, 3);
  assert.equal(landed.phase, "buy");
  const bought = step(tycoonGame, landed, { type: "buy" });
  assert.equal(bought.money.A, 1430);
  assert.deepEqual(bought.props[3], { owner: "A", level: 0 });
  assert.equal(bought.phase, "end");
  noOp(tycoonGame, bought, { type: "buy" });
  const next = step(tycoonGame, bought, { type: "end" });
  assert.equal(tycoonGame.currentPlayer!(next), "B");
  assert.equal(next.phase, "roll");
  assert.equal(next.dice, null);
  assert.equal(next.round, 1);
});

test("Tycoon rejects wrong players, wrong phases, unaffordable purchases and invalid upgrades", () => {
  const initial = tycoonGame.init(["A", "B"]);
  withRandom([], () => {
    for (const by of ["B", "outsider"]) noOp(tycoonGame, initial, { type: "roll" }, by);
    for (const type of ["buy", "skip", "end", "invalid"]) noOp(tycoonGame, initial, { type });
    noOp(tycoonGame, initial, { type: "upgrade", square: 1 });
    noOp(tycoonGame, { ...initial, phase: "buy", position: { A: 3, B: 0 }, money: { A: 69, B: 1500 } }, { type: "buy" });
    const end = { ...initial, phase: "end" as const, props: { 1: { owner: "A", level: 0 } } };
    noOp(tycoonGame, end, { type: "roll" });
    noOp(tycoonGame, end, { type: "upgrade", square: 1 }); // Missing the other city in the group.
    noOp(tycoonGame, end, { type: "upgrade", square: 5 }); // Not an owned city.
    noOp(tycoonGame, { ...end, props: { ...end.props, 3: { owner: "A", level: 0 } }, money: { A: 29, B: 1500 } }, { type: "upgrade", square: 1 });
  });
});

test("Tycoon doubles unimproved group rent and charges upgraded rent after passing START", () => {
  const initial = tycoonGame.init(["A", "B"]);
  const owned = { ...initial, props: { 1: { owner: "A", level: 0 }, 3: { owner: "A", level: 0 } } };
  const groupRent = withRolls([1, 2], () => step(tycoonGame, { ...owned, turn: 1 }, { type: "roll" }, "B"));
  assert.deepEqual(groupRent.money, { A: 1514, B: 1486 });
  const upgraded = step(tycoonGame, { ...owned, phase: "end" }, { type: "upgrade", square: 1 });
  assert.equal(upgraded.money.A, 1470);
  assert.equal(upgraded.props[1].level, 1);
  const rent = withRolls([1, 2], () => step(tycoonGame, { ...upgraded, turn: 1, phase: "roll", position: { A: 0, B: 18 } }, { type: "roll" }, "B"));
  assert.equal(rent.position.B, 1);
  assert.deepEqual(rent.money, { A: 1494, B: 1676 }); // B receives 200, then pays 6 * 4.
  assert.equal(rent.phase, "end");
});

test("Tycoon skips declined purchases and serves exactly one jail turn without rolling", () => {
  const initial = tycoonGame.init(["A", "B"]);
  const skipped = step(tycoonGame, { ...initial, phase: "buy", position: { A: 3, B: 0 } }, { type: "skip" });
  assert.equal(skipped.phase, "end");
  assert.deepEqual(skipped.money, initial.money);
  assert.deepEqual(skipped.props, {});
  const jailed = withRolls([1, 1], () => step(tycoonGame, { ...initial, position: { A: 16, B: 0 } }, { type: "roll" }));
  assert.equal(jailed.position.A, 10);
  assert.equal(jailed.jailed.A, true);
  const served = withRandom([], () => step(tycoonGame, { ...jailed, phase: "roll" }, { type: "roll" }));
  assert.equal(served.jailed.A, false);
  assert.equal(served.position.A, 10);
  assert.equal(served.turn, 1);
  assert.equal(served.phase, "roll");
  assert.equal(served.dice, null);
});

test("Tycoon bankruptcy releases properties and declares the last solvent player winner", () => {
  const initial = { ...tycoonGame.init(["A", "B"]), money: { A: 50, B: 1500 }, props: { 1: { owner: "A", level: 1 }, 3: { owner: "B", level: 0 } } };
  const won = withRolls([2, 2], () => step(tycoonGame, initial, { type: "roll" }));
  assert.equal(won.money.A, -50);
  assert.deepEqual(won.bankrupt, ["A"]);
  assert.equal(won.props[1], undefined);
  assert.deepEqual(won.props[3], initial.props[3]);
  assert.equal(tycoonGame.winner(won), "B");
  noOp(tycoonGame, won, { type: "end" });
  withRandom([], () => noOp(tycoonGame, won, { type: "roll" }, "B"));
});

test("Tycoon skips bankrupt seats and uses property-inclusive wealth at the round limit", () => {
  const initial = tycoonGame.init(["A", "B", "C"]);
  const next = step(tycoonGame, { ...initial, phase: "end", bankrupt: ["B"] }, { type: "end" });
  assert.equal(next.turn, 2);
  const won = step(tycoonGame, {
    ...tycoonGame.init(["A", "B"]), turn: 1, phase: "end", round: 25,
    money: { A: 100, B: 200 }, props: { 19: { owner: "A", level: 0 } },
  }, { type: "end" }, "B");
  assert.equal(tycoonGame.winner(won), "A", "Mumbai makes A wealthier despite having less cash");
});

test("Tycoon rejects out-of-range upgrade squares without throwing", () => {
  const state = { ...tycoonGame.init(["A", "B"]), phase: "end" as const };
  for (const square of [-1, 20, 0.5, NaN, Infinity]) noOp(tycoonGame, state, { type: "upgrade", square });
});

test("Dots alternates ordinary lines but awards a closed box and another turn to its closer", () => {
  let state = dotsGame.init(["A", "B"]);
  assert.equal(state.lines.length, 60);
  assert.equal(state.boxes.length, 25);
  for (const line of [0, 5, 30]) state = step(dotsGame, state, { type: "line", line }, state.players[state.turn]);
  assert.equal(state.turn, 1);
  assert.equal(state.boxes[0], null);
  state = step(dotsGame, state, { type: "line", line: 31 }, "B");
  assert.equal(state.boxes[0], 1);
  assert.equal(state.lines[31], 1);
  assert.equal(state.last, 31);
  assert.equal(dotsGame.currentPlayer!(state), "B");
  state = step(dotsGame, state, { type: "line", line: 32 }, "B");
  assert.equal(state.turn, 0);
});

test("Dots rejects wrong players, occupied lines and malformed line indices", () => {
  const initial = dotsGame.init(["A", "B"]);
  for (const by of ["B", "outsider"]) noOp(dotsGame, initial, { type: "line", line: 0 }, by);
  for (const line of [-1, 60, 0.5, NaN, Infinity]) noOp(dotsGame, initial, { type: "line", line });
  const state = step(dotsGame, initial, { type: "line", line: 0 });
  noOp(dotsGame, state, { type: "line", line: 0 }, "B");
});

test("Dots closes two neighboring boxes with one shared edge and keeps the turn", () => {
  const state = dotsGame.init(["A", "B"]);
  for (const line of [0, 1, 5, 6, 30, 32]) state.lines[line] = 1;
  const closed = step(dotsGame, state, { type: "line", line: 31 });
  assert.deepEqual(closed.boxes.slice(0, 2), [0, 0]);
  assert.equal(closed.boxes.filter((b) => b !== null).length, 2);
  assert.equal(closed.turn, 0);
  assert.equal(closed.winner, null);
});

test("Dots awards the final majority, not necessarily the player closing the last box", () => {
  const state = dotsGame.init(["A", "B"]);
  state.lines.fill(0);
  state.lines[59] = null;
  state.boxes = Array.from({ length: 25 }, (_, i) => i === 24 ? null : i < 13 ? 0 : 1);
  state.turn = 1;
  const won = step(dotsGame, state, { type: "line", line: 59 }, "B");
  assert.equal(won.boxes[24], 1);
  assert.equal(won.boxes.filter((b) => b === 0).length, 13);
  assert.equal(won.boxes.filter((b) => b === 1).length, 12);
  assert.equal(dotsGame.winner(won), "A");
  noOp(dotsGame, won, { type: "line", line: 59 }, "B");
});

test("Dots rejects an unknown action even with an available line index", () => {
  noOp(dotsGame, dotsGame.init(["A", "B"]), { type: "invalid", line: 0 });
});

function marks(cells: number[], state = ticTacToeGame.init(["A", "B"])) {
  for (const cell of cells) {
    assert.equal(state.roundOver, null, "fixture must not continue a finished round");
    state = step(ticTacToeGame, state, { type: "mark", cell }, state.players[state.turn]);
  }
  return state;
}

test("Tic-Tac-Toe places alternating marks and rejects wrong players, occupied cells and bad indices", () => {
  const initial = ticTacToeGame.init(["A", "B"]);
  for (const by of ["B", "outsider"]) noOp(ticTacToeGame, initial, { type: "mark", cell: 0 }, by);
  for (const cell of [-1, 9, 0.5, NaN, Infinity]) noOp(ticTacToeGame, initial, { type: "mark", cell });
  noOp(ticTacToeGame, initial, { type: "next", round: 1 });
  const state = marks([0, 4]);
  assert.equal(state.board[0], 0);
  assert.equal(state.board[4], 1);
  assert.equal(ticTacToeGame.currentPlayer!(state), "A");
  noOp(ticTacToeGame, state, { type: "mark", cell: 0 });
});

test("Tic-Tac-Toe scores a round, alternates starters and wins only on the third round victory", () => {
  const round = marks([0, 3, 1, 4, 2]);
  assert.deepEqual(round.roundOver, { line: [0, 1, 2] });
  assert.deepEqual(round.scores, [1, 0]);
  assert.equal(ticTacToeGame.winner(round), null);
  assert.equal(ticTacToeGame.currentPlayer!(round), null);
  noOp(ticTacToeGame, round, { type: "mark", cell: 8 });
  const next = step(ticTacToeGame, round, { type: "next", round: 1 }, "B");
  assert.deepEqual(next.scores, [1, 0]);
  assert.equal(next.starter, 1);
  assert.equal(next.turn, 1);
  assert.equal(next.round, 2);
  assert.deepEqual(next.board, Array(9).fill(null));
  const won = marks([0, 3, 1, 4, 2], { ...ticTacToeGame.init(["A", "B"]), scores: [2, 1], round: 4 });
  assert.deepEqual(won.scores, [3, 1]);
  assert.equal(ticTacToeGame.winner(won), "A");
  noOp(ticTacToeGame, won, { type: "next", round: 4 });
  noOp(ticTacToeGame, won, { type: "mark", cell: 8 });
});

const ticDraw = () => marks([0, 1, 2, 4, 3, 5, 7, 6, 8]);

test("Tic-Tac-Toe replays a draw without scoring and ignores stale or duplicate next-round callbacks", () => {
  const drawn = ticDraw();
  assert.deepEqual(drawn.roundOver, { line: null });
  assert.deepEqual(drawn.scores, [0, 0]);
  assert.equal(drawn.winner, null);
  assert.equal(ticTacToeGame.currentPlayer!(drawn), null);
  noOp(ticTacToeGame, drawn, { type: "next", round: 0 });
  const next = step(ticTacToeGame, drawn, { type: "next", round: 1 });
  assert.equal(next.round, 2);
  assert.equal(next.turn, 1);
  assert.equal(next.roundOver, null);
  assert.deepEqual(next.scores, [0, 0]);
  noOp(ticTacToeGame, next, { type: "next", round: 1 }, "B");
});

test("Tic-Tac-Toe rejects unknown action types with an otherwise available cell", () => {
  noOp(ticTacToeGame, ticTacToeGame.init(["A", "B"]), { type: "invalid", cell: 0 });
});

test("Tic-Tac-Toe does not let a nonparticipant reset a finished round", () => {
  const drawn = ticDraw();
  noOp(ticTacToeGame, drawn, { type: "next", round: drawn.round }, "outsider");
});

test("Bounce binds its solo player and completes even a zero-score run exactly once", () => {
  const initial = bounceGame.init(["A"]);
  assert.deepEqual(initial, { best: 0, lastScore: null, plays: 0, player: "A" });
  assert.equal(bounceGame.winner(initial), null);
  const done = step(bounceGame, initial, { type: "over", score: 0 });
  assert.deepEqual(done, { best: 0, lastScore: 0, plays: 1, player: "A" });
  assert.equal(bounceGame.winner(done), "A");
  noOp(bounceGame, done, { type: "over", score: 0 });
  noOp(bounceGame, done, { type: "over", score: 500 });
  const scored = step(bounceGame, bounceGame.init(["A"]), { type: "over", score: 125 });
  assert.equal(scored.best, 125);
  assert.equal(scored.lastScore, 125);
  const best = step(bounceGame, { ...bounceGame.init(["A"]), best: 200 }, { type: "over", score: 125 });
  assert.equal(best.best, 200);
});

test("Bounce rejects wrong-player, non-finite, negative and wrong-type completion actions", () => {
  const initial = bounceGame.init(["A"]);
  for (const by of ["B", "outsider"]) noOp(bounceGame, initial, { type: "over", score: 10 }, by);
  for (const score of [-1, NaN, Infinity, -Infinity, "10", null, undefined]) noOp(bounceGame, initial, { type: "over", score });
  noOp(bounceGame, initial, { type: "invalid", score: 10 });
  noOp(bounceGame, initial, {});
});

test("Bounce completion pays once through a persisted session receipt, including after reload and cleanup", () => {
  const at = Date.parse("2026-11-12T12:00:00Z");
  const claimedAt = at + 86_400_000; // No date-dependent daily-dare bonus.
  const user: User = {
    id: "A", username: "a", displayName: "A", hue: 0, isGuest: false,
    hearts: 120, xp: 0, streak: 0, winStreak: 2, ownedThemes: [],
    appTheme: "rose", chatTheme: "classic", createdAt: at - 1000,
  };
  const initial = bounceGame.init(["A"]);
  const playing: GameSession = {
    id: "bounce-once", game: "bounce", players: ["A"], host: "A", status: "playing",
    state: initial, winner: null, convId: "game:bounce-once", rev: 0, createdAt: at - 1000, updatedAt: at - 1000,
  };
  const db: Pick<DB, "users" | "games"> = { users: { A: user }, games: [playing] };
  assert.throws(() => recordGameProgress(freeze(db), "A", playing.id, claimedAt), /Finish the game/);
  const done = step(bounceGame, initial, { type: "over", score: 125 });
  const finished = finalizeGameUpdate(playing, { ...playing, state: done, status: "finished", winner: bounceGame.winner(done), playedBy: ["A"] }, at);
  assert.equal(finished.winner, "A");
  assert.equal(finished.rev, 1);
  assert.equal(finished.finishedAt, at);
  const completed = { users: { A: user }, games: [finished] };
  const first = recordGameProgress(freeze(completed), "A", finished.id, claimedAt);
  assert.equal(first.receipt.outcome, "completed");
  assert.equal(first.receipt.winner, "A");
  assert.equal(first.receipt.completionHearts, COMPLETION_HEARTS);
  assert.equal(first.receipt.hearts, COMPLETION_HEARTS);
  assert.equal(first.receipt.xp, XP_PLAY);
  assert.equal(first.receipt.winHearts, 0);
  assert.equal(first.receipt.couple, undefined);
  assert.equal(first.user.hearts, user.hearts + COMPLETION_HEARTS);
  assert.equal(first.user.xp, XP_PLAY);
  assert.equal(first.user.wins, 0);
  assert.equal(first.user.winStreak, 2);
  assert.equal(first.user.gameStats!.bounce.played, 1);
  assert.equal(first.user.gameStats!.bounce.bestScore, 125);
  assert.equal(bounceGame.init(["A"], first.user).best, 125);
  assert.deepEqual(Object.keys(first.user.gameReceipts!), [finished.id]);
  assert.equal(user.hearts, 120, "claim reducer does not mutate the original wallet");
  const persisted = { users: { A: first.user }, games: [finished] };
  const again = recordGameProgress(freeze(persisted), "A", finished.id, claimedAt + 1);
  assert.strictEqual(again.user, first.user);
  assert.strictEqual(again.receipt, first.receipt);
  const reloaded = JSON.parse(JSON.stringify(persisted)) as Pick<DB, "users" | "games">;
  reloaded.games = [];
  const paidProfile = structuredClone(reloaded.users.A);
  const afterCleanup = recordGameProgress(freeze(reloaded), "A", finished.id, claimedAt + 86_400_000);
  assert.deepEqual(afterCleanup.user, paidProfile);
  assert.deepEqual(afterCleanup.receipt, JSON.parse(JSON.stringify(first.receipt)));
  const replay = step(bounceGame, done, { type: "over", score: 999 });
  assert.strictEqual(replay, done);
  assert.strictEqual(finalizeGameUpdate(finished, { ...finished, state: replay }, claimedAt), finished);
});
