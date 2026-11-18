import assert from "node:assert/strict";
import test from "node:test";
import { poolGame, simulate, canPlaceCue, poolTablePoint, POOL_REPLAY_MS } from "../src/games/pool";
import { chessGame, positionKey } from "../src/games/chess";

type PoolState = ReturnType<typeof poolGame.init>;
type ChessState = ReturnType<typeof chessGame.init>;
const ball = (id: number, x: number, y: number) => ({ id, x, y, potted: false });
const shot = (power = 0.5, angle = -Math.PI / 2) => ({ type: "shoot" as const, angle, power });
const pool = (balls: PoolState["balls"], open = false): PoolState => ({
  ...poolGame.init(["A", "B"]), balls, groups: open ? { A: null, B: null } : { A: "solids", B: "stripes" },
});

test("pool: wrong first contact cannot win on black, even with the group already cleared", () => {
  const state = pool([ball(0, 100, 50), ball(9, 100, 14), ball(8, 100, 8)]);
  const physics = simulate(state.balls, shot().angle, shot().power);
  assert.equal(physics.firstHit, 9);
  assert.ok(physics.potted.includes(8));
  assert.equal(poolGame.apply(state, shot(), "A").winner, "B");
});

test("pool: potting the last group ball and black together is a loss", () => {
  const state = pool([ball(0, 100, 50), ball(1, 100, 14), ball(8, 100, 8)]);
  const physics = simulate(state.balls, shot(1).angle, 1);
  assert.equal(physics.firstHit, 1);
  assert.ok(physics.potted.includes(1) && physics.potted.includes(8));
  assert.ok(!physics.potted.includes(0));
  assert.equal(poolGame.apply(state, shot(1), "A").winner, "B");
});

test("pool: legal black wins only after the group was cleared", () => {
  const balls = [ball(0, 100, 50), ball(8, 100, 8)];
  assert.equal(poolGame.apply(pool(balls), shot(), "A").winner, "A");
  assert.equal(poolGame.apply(pool(balls, true), shot(), "A").winner, "B");
  const scratched = poolGame.apply(pool(balls), shot(1), "A");
  assert.equal(scratched.winner, "B");
  assert.match(scratched.log, /scratch/);
});

test("pool: wrong contact cannot earn an extra turn from an own-group pot", () => {
  const state = pool([ball(0, 100, 50), ball(9, 100, 14), ball(1, 100, 8)]);
  const next = poolGame.apply(state, shot(), "A");
  assert.ok(next.balls.find((b) => b.id === 1)!.potted);
  assert.equal(next.turn, 1);
  assert.equal(next.ballInHand, "B");
  assert.match(next.log, /wrong ball first/);
});

test("pool: only a legal pot assigns groups and keeps the turn", () => {
  const state = pool([ball(0, 100, 50), ball(1, 100, 8)], true);
  const legal = poolGame.apply(state, shot(), "A");
  assert.deepEqual(legal.groups, { A: "solids", B: "stripes" });
  assert.equal(legal.turn, 0);
  assert.equal(legal.ballInHand, null);
  const scratch = poolGame.apply(state, shot(1), "A");
  assert.deepEqual(scratch.groups, { A: null, B: null });
  assert.equal(scratch.ballInHand, "B");
});

test("pool: no contact, scratch, and no cushion/pocket after contact all give ball in hand", () => {
  for (const [state, action, reason] of [
    [pool([ball(0, 50, 50)]), shot(0.1, 0), /didn't hit/],
    [pool([ball(0, 100, 50)]), shot(), /scratch/],
    [pool([ball(0, 50, 50), ball(1, 70, 50)]), shot(0.1, 0), /no cushion/],
    // The cue touches a rail BEFORE the object ball; that rail cannot legalize the shot.
    [pool([ball(0, 10, 50), ball(1, 20, 50)]), shot(0.1, Math.PI), /no cushion/],
  ] as const) {
    const next = poolGame.apply(state, action, "A");
    assert.equal(next.turn, 1);
    assert.equal(next.ballInHand, "B");
    assert.ok(next.balls.find((b) => b.id === 0)!.potted);
    assert.match(next.log, reason);
  }
});

test("pool: a cushion after correct contact is legal even without a pot", () => {
  const state = pool([ball(0, 50, 50), ball(1, 70, 50)]);
  const physics = simulate(state.balls, 0, 0.5);
  assert.equal(physics.firstHit, 1);
  assert.equal(physics.railOrPocketAfterContact, true);
  assert.deepEqual(physics.potted, []);
  const next = poolGame.apply(state, shot(0.5, 0), "A");
  assert.equal(next.turn, 1);
  assert.equal(next.ballInHand, null);
});

test("pool: placement is turn-gated, bounded, finite, outside pockets and nonoverlapping", () => {
  const state: PoolState = { ...pool([ball(0, 100, 50), ball(1, 50, 50)]), turn: 1, ballInHand: "B" };
  for (const [x, y] of [[50, 50], [54, 50], [-1, 50], [200, 50], [50, 0], [50, 101], [100, 2.6], [2.6, 2.6], [NaN, 50], [50, Infinity]]) {
    assert.equal(canPlaceCue(state.balls, x, y), false);
    assert.equal(poolGame.apply(state, { type: "place", x, y }, "B"), state);
  }
  assert.equal(poolGame.apply(state, shot(), "B"), state);
  assert.equal(poolGame.apply(state, { type: "place", x: 70, y: 50 }, "A"), state);
  const next = poolGame.apply(state, { type: "place", x: 70, y: 50 }, "B");
  assert.equal(next.ballInHand, null);
  assert.equal(next.turn, 1);
  assert.equal(next.shotNo, state.shotNo);
  assert.deepEqual(next.balls[0], ball(0, 70, 50));
  assert.equal(poolGame.apply(next, { type: "place", x: 80, y: 50 }, "B"), next);
});

test("pool: bots place safely when the default cue spot is occupied, then can shoot", () => {
  const state: PoolState = { ...pool([ball(0, 100, 50), ball(1, 50, 50), ball(9, 120, 50)]), turn: 1, ballInHand: "B" };
  const action = poolGame.botMove!(state, "B")!;
  assert.equal(action.type, "place");
  assert.deepEqual(poolGame.botMove!(state, "B"), action);
  const placed = poolGame.apply(state, action, "B");
  assert.notEqual(placed, state);
  assert.equal(placed.ballInHand, null);
  assert.equal(poolGame.botMove!(placed, "B")!.type, "shoot");
});

test("pool: simulation/reduction stay deterministic and do not mutate a shot snapshot", () => {
  const state = poolGame.init(["A", "B"]);
  const before = structuredClone(state);
  const action = shot(0.7, 0);
  const a = simulate(state.balls, action.angle, action.power);
  assert.deepEqual(simulate(state.balls, action.angle, action.power), a);
  assert.deepEqual(a.frames.at(-1), a.end);
  assert.deepEqual(poolGame.apply(state, action, "A"), poolGame.apply(state, action, "A"));
  assert.deepEqual(state, before);
  for (const action of [shot(NaN), shot(0.5, Infinity)]) assert.equal(poolGame.apply(state, action, "A"), state);
});

test("pool: low slider powers differ and CSS-scaled touch coordinates map to the felt", () => {
  const balls = [ball(0, 50, 50)];
  const slow = simulate(balls, 0, 0.1).frames[0][0].x;
  const fast = simulate(balls, 0, 0.4).frames[0][0].x;
  assert.ok(fast > slow);
  for (const scale of [1.5, 4]) {
    const rect = { left: 20, top: 30, width: 212 * scale, height: 112 * scale };
    const point = poolTablePoint(rect, 20 + 106 * scale, 30 + 56 * scale);
    assert.deepEqual(point, { x: 100, y: 50 });
    assert.deepEqual(poolTablePoint(rect, 20 + 6 * scale, 30 + 6 * scale), { x: 0, y: 0 });
  }
  assert.ok(POOL_REPLAY_MS < poolGame.botDelay!);
});

const square = (name: string) => (8 - Number(name[1])) * 8 + "abcdefgh".indexOf(name[0]);
function position(pieces: Record<string, NonNullable<ChessState["board"][number]>>, patch: Partial<ChessState> = {}): ChessState {
  const state: ChessState = { ...chessGame.init(["A", "B"]), board: Array(64).fill(null), castling: "", ...patch };
  for (const [name, piece] of Object.entries(pieces)) state.board[square(name)] = piece;
  state.repetitions = { [positionKey(state)]: 1 };
  return state;
}
function move(state: ChessState, from: string, to: string, promo?: "Q" | "R" | "B" | "N") {
  const next = chessGame.apply(state, { type: "move", from: square(from), to: square(to), ...(promo ? { promo } : {}) }, chessGame.currentPlayer!(state)!);
  assert.notEqual(next, state, `${from}-${to} must be legal`);
  return next;
}
const cycle = [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]] as const;
function repeat(state: ChessState, times: number) {
  for (let n = 0; n < times; n += 1) for (const [from, to] of cycle) state = move(state, from, to);
  return state;
}

test("chess: four knight cycles trigger automatic fivefold, not premature threefold", () => {
  const initial = chessGame.init(["A", "B"]);
  const threefold = repeat(initial, 2);
  assert.equal(threefold.over, null);
  assert.equal(threefold.repetitions[positionKey(initial)], 3);
  const fivefold = repeat(threefold, 2);
  assert.equal(fivefold.over?.reason, "fivefold repetition");
  assert.equal(fivefold.over?.result, "draw");
  assert.equal(chessGame.currentPlayer!(fivefold), null);
  assert.equal(chessGame.winner(fivefold), "draw");
  assert.equal(initial.repetitions[positionKey(initial)], 1);
  assert.equal(chessGame.apply(fivefold, { type: "move", from: 62, to: 45 }, "A"), fivefold);
  const replay = chessGame.init(["B", "A"]);
  assert.equal(replay.over, null);
  assert.deepEqual(Object.values(replay.repetitions), [1]);
});

test("chess: valid threefold claims are turn-gated and invalid claims are no-ops", () => {
  const initial = chessGame.init(["A", "B"]);
  assert.equal(chessGame.apply(initial, { type: "claimDraw" }, "A"), initial);
  const state = repeat(initial, 2);
  assert.equal(chessGame.apply(state, { type: "claimDraw" }, "B"), state);
  assert.equal(chessGame.apply(state, { type: "claimDraw" }, "outsider"), state);
  assert.equal(chessGame.apply(state, { type: "claimDraw" }, "A").over?.reason, "threefold repetition");
  assert.equal(chessGame.botMove!(state, "A")!.type, "claimDraw");
});

test("chess: an announced legal move may claim repetition without executing that move", () => {
  let state = repeat(chessGame.init(["A", "B"]), 1);
  for (const [from, to] of cycle.slice(0, 3)) state = move(state, from, to);
  assert.equal(chessGame.apply(state, { type: "claimDraw" }, "B"), state);
  const claim = { type: "claimDraw" as const, move: { from: square("f6"), to: square("g8") } };
  const result = chessGame.apply(state, claim, "B");
  assert.equal(result.over?.reason, "threefold repetition");
  assert.deepEqual(result.board, state.board);
  assert.equal(chessGame.apply(state, { ...claim, move: { from: square("f6"), to: square("f8") } }, "B"), state);
});

test("chess: repetition keys include turn/castling and only legally available en passant", () => {
  const initial = chessGame.init(["A", "B"]);
  assert.notEqual(positionKey(initial), positionKey({ ...initial, turn: "b" }));
  assert.notEqual(positionKey(initial), positionKey({ ...initial, castling: "KQk" }));
  assert.equal(positionKey(initial), positionKey({ ...initial, castling: "qkQK", half: 90 }));
  const uncapturable = move(initial, "e2", "e4");
  assert.equal(positionKey(uncapturable), positionKey({ ...uncapturable, ep: null }));
  const legal = position({ e1: "wK", a8: "bK", e5: "wP", d5: "bP" }, { ep: square("d6") });
  assert.notEqual(positionKey(legal), positionKey({ ...legal, ep: null }));
  const pinned = position({ e1: "wK", a8: "bK", e8: "bR", e5: "wP", d5: "bP" }, { ep: square("d6") });
  assert.equal(positionKey(pinned), positionKey({ ...pinned, ep: null }));
  assert.equal(chessGame.apply(pinned, { type: "move", from: square("e5"), to: square("d6") }, "A"), pinned);
});

test("chess: 50 moves are claimable, 75 moves automatic, pawn moves/captures reset the clock", () => {
  const pieces = { a1: "wK", b1: "wR", h8: "bK", g8: "bR", c2: "wP" } as const;
  const state = position(pieces, { half: 99 });
  assert.equal(chessGame.apply(state, { type: "claimDraw" }, "A"), state);
  const quiet = move(state, "b1", "b2");
  assert.equal(quiet.half, 100);
  assert.equal(quiet.over, null);
  assert.equal(chessGame.apply(quiet, { type: "claimDraw" }, "B").over?.reason, "50 moves");
  const intended = chessGame.apply(state, { type: "claimDraw", move: { from: square("b1"), to: square("b2") } }, "A");
  assert.equal(intended.over?.reason, "50 moves");
  const pawnClaim = { type: "claimDraw" as const, move: { from: square("c2"), to: square("c3") } };
  assert.equal(chessGame.apply(state, pawnClaim, "A"), state);
  assert.equal(move(state, "c2", "c3").half, 0);
  assert.equal(move(position(pieces, { half: 149 }), "b1", "b2").over?.reason, "75 moves");
  const capture = position({ ...pieces, b2: "bN" }, { half: 149 });
  assert.equal(move(capture, "b1", "b2").half, 0);
});

test("chess: checkmate takes precedence over the automatic 75-move draw", () => {
  const state = position({ f6: "wK", g6: "wQ", h8: "bK" }, { half: 149 });
  const next = move(state, "g6", "g7");
  assert.equal(next.half, 150);
  assert.equal(next.over?.result, "mate");
  assert.equal(next.winner, "A");
});

test("chess: same-colour bishops are dead; opposite-colour bishops and two knights are not", () => {
  const same = position({ a1: "wK", c1: "wB", h8: "bK", f8: "bB" });
  assert.equal(move(same, "a1", "b1").over?.reason, "material");
  const opposite = position({ a1: "wK", c1: "wB", h8: "bK", c8: "bB" });
  assert.equal(move(opposite, "a1", "b1").over, null);
  const knights = position({ a1: "wK", c1: "wN", d1: "wN", h8: "bK" });
  assert.equal(move(knights, "a1", "b1").over, null);
  assert.equal(move(position({ a1: "wK", c1: "wB", h8: "bK" }), "a1", "b1").over?.reason, "material");
});

test("chess: castling, en passant, promotion and stalemate remain intact", () => {
  const castle = move(position({ e1: "wK", h1: "wR", e8: "bK" }, { castling: "K" }), "e1", "g1");
  assert.equal(castle.board[square("g1")], "wK");
  assert.equal(castle.board[square("f1")], "wR");
  assert.equal(castle.castling, "");
  const blocked = position({ e1: "wK", h1: "wR", a8: "bK", f8: "bR" }, { castling: "K" });
  assert.equal(chessGame.apply(blocked, { type: "move", from: square("e1"), to: square("g1") }, "A"), blocked);
  const ep = move(position({ e1: "wK", a8: "bK", e5: "wP", d5: "bP" }, { ep: square("d6"), half: 99 }), "e5", "d6");
  assert.equal(ep.board[square("d5")], null);
  assert.equal(ep.board[square("d6")], "wP");
  assert.equal(ep.half, 0);
  assert.deepEqual(ep.captured, ["bP"]);
  assert.equal(move(position({ a1: "wK", a7: "wP", h8: "bK" }), "a7", "a8", "N").board[square("a8")], "wN");
  assert.equal(move(position({ f7: "wK", g5: "wQ", h8: "bK" }), "g5", "g6").over?.reason, "stalemate");
});
