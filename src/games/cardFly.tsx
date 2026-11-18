// Card motion for the card games: cards fly from the deck to a hand, from a
// hand to the pile, and are dealt at the start of a round. It watches the
// game state, compares it with the last one and animates the difference, so
// game logic stays untouched. Views only mark elements with data attributes:
//   data-fly-deck            the draw pile
//   data-fly-pile="<id>"     a card lying on the pile / trick / board
//   data-fly-pile-spot       where new pile cards land when not found by id
//   data-fly-card="<id>"     a card in my hand
//   data-fly-hand            my hand area
//   data-fly-seat="<player>" an opponent's seat
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { play } from "./sfx";

interface CardLike {
  id: number;
}

export interface Snapshot<C extends CardLike> {
  hands: Record<string, C[]>;
  // Cards lying face up in the middle (discard pile, trick, board).
  pile: C[];
  // Changes when a new round is dealt.
  round: string | number;
}

interface Flight {
  key: string;
  from: DOMRect;
  to: DOMRect;
  face: ReactNode | null;
  back: ReactNode;
  flip: boolean;
  delay: number;
  tilt: number;
  hide: Element | null;
  sound: "deal" | "card" | "draw";
}

const DURATION = 430;
const STAGGER = 120;
const SHUFFLE_DELAY = 470;
const MAX_SEQUENCE_MS = 2000;
const MAX_FLIGHTS = 24;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const hidden = new WeakMap<HTMLElement, { count: number; visibility: string }>();

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function hideTarget(target: Element | null) {
  if (!(target instanceof HTMLElement)) return () => {};
  const entry = hidden.get(target) ?? { count: 0, visibility: target.style.visibility };
  entry.count += 1;
  hidden.set(target, entry);
  target.style.visibility = "hidden";
  return () => {
    entry.count -= 1;
    if (entry.count === 0) {
      target.style.visibility = entry.visibility;
      hidden.delete(target);
    }
  };
}

function FlyingCard({ flight, onDone }: { flight: Flight; onDone: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const media = window.matchMedia?.(REDUCED_MOTION);
    const animations: Animation[] = [];
    let release = () => {};
    let done = false;
    let sound: number | undefined;
    let deadline: number | undefined;
    const cleanup = () => {
      window.clearTimeout(sound);
      window.clearTimeout(deadline);
      media?.removeEventListener?.("change", motionChanged);
      animations.forEach((animation) => {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
      });
      release();
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      onDone(flight.key);
    };
    function motionChanged(event: MediaQueryListEvent) {
      if (event.matches) finish();
    }
    const { from, to } = flight;
    const a = center(from);
    const b = center(to);
    const sx = Math.max(0.3, from.width / to.width);
    const sy = Math.max(0.3, from.height / to.height);
    const sliding = flight.sound === "card";
    const start = `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${sx}, ${sy}) rotate(${flight.tilt * -2}deg)`;
    const mid = `translate(${(a.x - b.x) * 0.35}px, ${(a.y - b.y) * 0.35 - (sliding ? 3 : 30)}px) scale(${sliding ? 1 : 1.12}) rotate(${flight.tilt * 0.5}deg)`;
    const end = `translate(0, 0) scale(1) rotate(${flight.tilt}deg)`;
    const opts: KeyframeAnimationOptions = { duration: DURATION, delay: flight.delay, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" };
    try {
      if (!media?.matches && typeof el.animate === "function") {
        // The effect owns hiding, so StrictMode replay restores then re-hides safely.
        release = hideTarget(flight.hide);
        const anim = el.animate([{ transform: start, opacity: 0.85 }, { transform: mid, opacity: 1, offset: 0.55 }, { transform: end, opacity: 1 }], opts);
        animations.push(anim);
        if (flight.flip && inner.current) {
          animations.push(inner.current.animate([{ transform: "rotateY(180deg)" }, { transform: "rotateY(180deg)", offset: 0.35 }, { transform: "rotateY(0deg)" }], opts));
        }
        anim.onfinish = finish;
        anim.oncancel = finish;
      }
    } catch {
      // An unavailable animation API must never leave a real card hidden.
      animations.forEach((animation) => animation.cancel());
      animations.length = 0;
      release();
      release = () => {};
    }
    sound = window.setTimeout(() => {
      play(flight.sound, flight.sound === "deal" ? 0.65 : 0.5);
      if (!animations.length) finish();
    }, animations.length ? flight.delay : 0);
    deadline = window.setTimeout(finish, Math.min(flight.delay + DURATION, MAX_SEQUENCE_MS) + 150);
    media?.addEventListener?.("change", motionChanged);
    return () => {
      if (done) return;
      done = true;
      cleanup();
    };
  }, [flight, onDone]);

  const { to } = flight;
  return (
    <div ref={ref} className="fly-card" style={{ left: to.left, top: to.top, width: to.width, height: to.height, ["--fly-w" as string]: `${to.width}px` }}>
      <div ref={inner} className="fly-card-inner">
        <div className="fly-face fly-face--back">{flight.back}</div>
        {flight.face && <div className="fly-face fly-face--front">{flight.face}</div>}
      </div>
    </div>
  );
}

// Size used when a flight lands on a container instead of a card.
const DEFAULT = { w: 52, h: 74 };

function rectOf(el: Element | null | undefined) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

function cardBox(r: DOMRect, size = DEFAULT) {
  const c = center(r);
  return new DOMRect(c.x - size.w / 2, c.y - size.h / 2, size.w, size.h);
}

export function useCardFlights<C extends CardLike>({
  root,
  me,
  snapshot,
  renderFace,
  renderBack,
  dealLimit = 6,
}: {
  root: RefObject<HTMLElement>;
  me: string;
  snapshot: Snapshot<C>;
  renderFace: (card: C) => ReactNode;
  renderBack: () => ReactNode;
  dealLimit?: number;
}) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const prev = useRef<Snapshot<C> | null>(null);
  const dealtRound = useRef<Snapshot<C>["round"] | null>(null);
  // Where my hand cards were on the last render (they vanish when played).
  const handRects = useRef(new Map<number, DOMRect>());
  const pileRects = useRef(new Map<number, DOMRect>());
  const seq = useRef(0);
  const onDone = useCallback((key: string) => setFlights((list) => list.filter((flight) => flight.key !== key)), []);

  const q = (sel: string) => root.current?.querySelector(sel) ?? null;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const before = prev.current;
    prev.current = snapshot;
    const newRound = !before || before.round !== snapshot.round;
    if (newRound) dealtRound.current = null;
    const dealing = dealtRound.current !== snapshot.round && Object.values(snapshot.hands).some((hand) => hand.length > 0);
    const canAnimate = typeof el.animate === "function" && !window.matchMedia?.(REDUCED_MOTION).matches;
    const deck = rectOf(q("[data-fly-deck], .card-back--deck")) ?? rectOf(q("[data-fly-pile-spot]"));
    const pileSpot = rectOf(q("[data-fly-pile-spot]"));
    const seatRect = (player: string) => (player === me ? rectOf(q("[data-fly-hand], .my-hand")) : rectOf(q(`[data-fly-seat="${CSS.escape(player)}"]`)));
    const made: Flight[] = [];
    const add = (f: Omit<Flight, "key" | "back">) => {
      if (made.length < MAX_FLIGHTS) made.push({ ...f, back: renderBack(), key: `f${seq.current++}` });
    };
    const enqueue = (replace = false) => {
      const firstDelay = dealing ? SHUFFLE_DELAY : 0;
      const span = Math.max(0, ...made.map((flight) => flight.delay - firstDelay));
      const budget = MAX_SEQUENCE_MS - DURATION - firstDelay;
      const scale = span > budget ? budget / span : 1;
      made.forEach((flight) => { flight.delay = firstDelay + (flight.delay - firstDelay) * scale; });
      setFlights((list) => (replace ? made : [...list, ...made]).slice(-MAX_FLIGHTS));
    };
    const tiltOf = (id: number) => ((id * 37) % 13) - 6;

    if (dealing) {
      // Record the deal before playback; StrictMode replays effects with refs intact.
      dealtRound.current = snapshot.round;
      play("shuffle", 0.8);
      if (canAnimate && deck) {
        const limit = Number.isFinite(dealLimit) ? Math.max(0, Math.min(MAX_FLIGHTS, Math.floor(dealLimit))) : 6;
        for (let round = 0; round < limit && made.length < MAX_FLIGHTS; round += 1) {
          for (const player of Object.keys(snapshot.hands)) {
            if (made.length >= MAX_FLIGHTS) break;
            const card = snapshot.hands[player][round];
            if (!card) continue;
            const mine = player === me;
            const target = mine ? q(`[data-fly-card="${card.id}"]`) : null;
            const seat = seatRect(player);
            const to = rectOf(target) ?? (seat && cardBox(seat));
            if (!to) continue;
            add({ from: cardBox(deck, { w: to.width, h: to.height }), to, face: mine ? renderFace(card) : null, flip: mine, delay: SHUFFLE_DELAY + made.length * 55, tilt: 0, hide: target, sound: "deal" });
          }
        }
      }
      if (!made.length) play("deal", 0.65);
      enqueue(true);
      return remember();
    }
    if (newRound || !before) {
      if (flights.length) setFlights([]);
      return remember();
    }

    const prevPile = new Set(before.pile.map((c) => c.id));
    const nextPile = new Set(snapshot.pile.map((c) => c.id));
    const placed = snapshot.pile.filter((c) => !prevPile.has(c.id));
    const taken = before.pile.filter((c) => !nextPile.has(c.id));
    // A pile that was cleared (trick collected, reshuffle) is not a move.
    const pileReset = taken.length > 1 && placed.length === 0;
    if (!canAnimate) {
      if (flights.length) setFlights([]);
      if (placed.length) play("card", 0.5);
      if (!pileReset && Object.entries(snapshot.hands).some(([player, hand]) => {
        const had = new Set((before.hands[player] ?? []).map((card) => card.id));
        const gained = hand.filter((card) => !had.has(card.id)).length;
        return gained > 0 && gained <= 13;
      })) play("draw", 0.5);
      return remember();
    }
    let wait = 0;

    for (const card of placed) {
      if (made.length >= MAX_FLIGHTS) break;
      const owner = Object.keys(before.hands).find((p) => before.hands[p].some((c) => c.id === card.id) && !snapshot.hands[p]?.some((c) => c.id === card.id));
      const target = q(`[data-fly-pile="${card.id}"]`);
      const to = rectOf(target) ?? (pileSpot && cardBox(pileSpot));
      if (!to) continue;
      let from: DOMRect | null = null;
      if (owner === me) from = handRects.current.get(card.id) ?? seatRect(me);
      else if (owner) from = seatRect(owner) && cardBox(seatRect(owner)!, { w: to.width * 0.6, h: to.height * 0.6 });
      else from = deck;
      if (!from) continue;
      add({ from, to, face: renderFace(card), flip: owner !== me && owner !== undefined, delay: wait, tilt: target ? 0 : tiltOf(card.id), hide: target, sound: "card" });
      wait += STAGGER;
    }
    if (placed.length) wait += 200;

    if (!pileReset) {
      for (const player of Object.keys(snapshot.hands)) {
        const had = new Set((before.hands[player] ?? []).map((c) => c.id));
        const gained = snapshot.hands[player].filter((c) => !had.has(c.id));
        if (gained.length === 0 || gained.length > 13) continue;
        gained.forEach((card) => {
          if (made.length >= MAX_FLIGHTS) return;
          const mine = player === me;
          const fromPile = taken.some((t) => t.id === card.id);
          const from = fromPile ? pileRects.current.get(card.id) ?? pileSpot : deck;
          const target = mine ? q(`[data-fly-card="${card.id}"]`) : null;
          const seat = seatRect(player);
          const to = rectOf(target) ?? (seat && cardBox(seat, { w: 40, h: 58 }));
          if (!from || !to) return;
          add({ from: fromPile ? from : cardBox(from, { w: to.width, h: to.height }), to, face: mine || fromPile ? renderFace(card) : null, flip: mine && !fromPile, delay: wait, tilt: 0, hide: target, sound: "draw" });
          wait += STAGGER;
        });
      }
    }

    if (made.length) enqueue();
    remember();

    function remember() {
      const host = root.current;
      if (!host) return;
      handRects.current.clear();
      host.querySelectorAll("[data-fly-card]").forEach((n) => {
        const r = rectOf(n);
        if (r) handRects.current.set(Number((n as HTMLElement).dataset.flyCard), r);
      });
      pileRects.current.clear();
      host.querySelectorAll("[data-fly-pile]").forEach((n) => {
        const r = rectOf(n);
        if (r) pileRects.current.set(Number((n as HTMLElement).dataset.flyPile), r);
      });
    }
  });

  // Keep hand positions fresh when the window resizes or the hand reflows.
  useEffect(() => {
    const save = () => {
      root.current?.querySelectorAll("[data-fly-card]").forEach((n) => {
        const r = rectOf(n);
        if (r) handRects.current.set(Number((n as HTMLElement).dataset.flyCard), r);
      });
    };
    window.addEventListener("resize", save);
    return () => window.removeEventListener("resize", save);
  }, [root]);

  const layer =
    typeof document === "undefined"
      ? null
      : createPortal(
          <div className="fly-layer" aria-hidden="true">
            {flights.map((f) => (
              <FlyingCard key={f.key} flight={f} onDone={onDone} />
            ))}
          </div>,
          document.body,
        );

  return layer;
}
