// Tiny synthesized sound kit (Web Audio), so games need no audio files.

export type Sfx =
  | "tap"
  | "roll"
  | "step"
  | "capture"
  | "climb"
  | "slide"
  | "home"
  | "card"
  | "draw"
  | "place"
  | "drop"
  | "line"
  | "box"
  | "jump"
  | "king"
  | "clack"
  | "cushion"
  | "pocket"
  | "coin"
  | "turn"
  | "win"
  | "lose"
  | "bounce"
  | "error"
  | "chips"
  | "deal"
  | "fold"
  | "check"
  | "gunshot"
  | "axe"
  | "fall"
  | "march"
  | "levelup"
  | "reward";

const MUTE_KEY = "cp_sfx_muted";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<(m: boolean) => void>();

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// Browsers only allow audio after a user gesture; unlock on the first one.
if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

export const isMuted = () => muted;

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* storage blocked */
  }
  listeners.forEach((fn) => fn(value));
}

export function onMuteChange(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number;
  attack?: number;
}

function tone(ac: AudioContext, { freq, to, dur, type = "sine", vol = 0.3, at = 0, attack = 0.005 }: ToneOpts) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(ac: AudioContext, { dur, vol = 0.3, at = 0, freq = 2000, q = 1, type = "bandpass" }: { dur: number; vol?: number; at?: number; freq?: number; q?: number; type?: BiquadFilterType }) {
  const t = ac.currentTime + at;
  const length = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master!);
  src.start(t);
}

const notes = (ac: AudioContext, freqs: number[], gap: number, opts: Partial<ToneOpts> = {}) =>
  freqs.forEach((freq, i) => tone(ac, { freq, dur: gap * 1.6, at: i * gap, ...opts }));

export function play(name: Sfx, volume = 1) {
  if (muted) return;
  const ac = audio();
  if (!ac || !master || ac.state !== "running") return;
  const v = (x: number) => x * volume;
  switch (name) {
    case "tap":
      tone(ac, { freq: 660, to: 880, dur: 0.06, type: "triangle", vol: v(0.15) });
      break;
    case "roll":
      for (let i = 0; i < 7; i += 1) noise(ac, { dur: 0.05, vol: v(0.35), at: i * 0.06 + Math.random() * 0.02, freq: 1800 + Math.random() * 1600, q: 3 });
      tone(ac, { freq: 220, dur: 0.08, type: "triangle", vol: v(0.25), at: 0.46 });
      break;
    case "step":
      tone(ac, { freq: 520 + Math.random() * 60, to: 760, dur: 0.07, type: "triangle", vol: v(0.16) });
      break;
    case "capture":
      tone(ac, { freq: 300, to: 60, dur: 0.35, type: "sawtooth", vol: v(0.2) });
      noise(ac, { dur: 0.25, vol: v(0.4), freq: 600, q: 0.7 });
      break;
    case "climb":
      notes(ac, [523, 659, 784, 1047], 0.08, { type: "triangle", vol: v(0.2) });
      break;
    case "slide":
      tone(ac, { freq: 900, to: 160, dur: 0.6, type: "sawtooth", vol: v(0.12) });
      noise(ac, { dur: 0.5, vol: v(0.12), freq: 3000, q: 0.5, type: "highpass" });
      break;
    case "home":
      notes(ac, [784, 988, 1175, 1568], 0.07, { type: "sine", vol: v(0.22) });
      break;
    case "card":
      noise(ac, { dur: 0.12, vol: v(0.35), freq: 3500, q: 0.8, type: "highpass" });
      tone(ac, { freq: 180, dur: 0.05, type: "triangle", vol: v(0.15), at: 0.08 });
      break;
    case "draw":
      noise(ac, { dur: 0.18, vol: v(0.25), freq: 2500, q: 0.6 });
      break;
    case "place":
      tone(ac, { freq: 340, to: 220, dur: 0.1, type: "triangle", vol: v(0.3) });
      noise(ac, { dur: 0.04, vol: v(0.2), freq: 1200, q: 2 });
      break;
    case "drop":
      tone(ac, { freq: 700, to: 200, dur: 0.18, type: "triangle", vol: v(0.22) });
      tone(ac, { freq: 160, dur: 0.12, type: "sine", vol: v(0.3), at: 0.17 });
      break;
    case "line":
      tone(ac, { freq: 880, dur: 0.06, type: "square", vol: v(0.06) });
      break;
    case "box":
      notes(ac, [660, 990], 0.07, { type: "triangle", vol: v(0.2) });
      break;
    case "jump":
      tone(ac, { freq: 300, to: 700, dur: 0.15, type: "triangle", vol: v(0.22) });
      noise(ac, { dur: 0.1, vol: v(0.25), freq: 800, q: 1, at: 0.12 });
      break;
    case "king":
      notes(ac, [523, 784, 1047], 0.09, { type: "square", vol: v(0.08) });
      break;
    case "clack":
      noise(ac, { dur: 0.03, vol: v(0.6), freq: 3200, q: 4 });
      tone(ac, { freq: 1900, dur: 0.03, type: "sine", vol: v(0.2) });
      break;
    case "cushion":
      tone(ac, { freq: 120, dur: 0.08, type: "sine", vol: v(0.25) });
      break;
    case "pocket":
      tone(ac, { freq: 240, to: 90, dur: 0.2, type: "sine", vol: v(0.4) });
      noise(ac, { dur: 0.15, vol: v(0.25), freq: 400, q: 1, at: 0.04 });
      break;
    case "coin":
      tone(ac, { freq: 988, dur: 0.08, type: "square", vol: v(0.08) });
      tone(ac, { freq: 1319, dur: 0.25, type: "square", vol: v(0.08), at: 0.07 });
      break;
    case "turn":
      notes(ac, [587, 880], 0.09, { type: "sine", vol: v(0.18) });
      break;
    case "win":
      notes(ac, [523, 659, 784], 0.11, { type: "triangle", vol: v(0.25) });
      notes(ac, [1047, 1047, 1319, 1568], 0.12, { type: "triangle", vol: v(0.22), at: 0.35 });
      tone(ac, { freq: 523, dur: 0.9, type: "sine", vol: v(0.15), at: 0.35 });
      break;
    case "lose":
      notes(ac, [494, 440, 392, 330], 0.16, { type: "triangle", vol: v(0.2) });
      break;
    case "bounce":
      tone(ac, { freq: 300, to: 620, dur: 0.1, type: "sine", vol: v(0.22) });
      break;
    case "error":
      tone(ac, { freq: 200, dur: 0.12, type: "square", vol: v(0.08) });
      break;
    case "chips":
      for (let i = 0; i < 4; i += 1) {
        noise(ac, { dur: 0.04, vol: v(0.45), freq: 4200 + Math.random() * 1500, q: 6, at: i * 0.045 + Math.random() * 0.015 });
        tone(ac, { freq: 2400 + Math.random() * 600, dur: 0.04, type: "sine", vol: v(0.08), at: i * 0.045 });
      }
      break;
    case "deal":
      noise(ac, { dur: 0.08, vol: v(0.3), freq: 5000, q: 0.7, type: "highpass" });
      break;
    case "fold":
      noise(ac, { dur: 0.2, vol: v(0.2), freq: 1500, q: 0.5 });
      tone(ac, { freq: 300, to: 180, dur: 0.15, type: "triangle", vol: v(0.1) });
      break;
    case "check":
      tone(ac, { freq: 140, dur: 0.06, type: "sine", vol: v(0.35) });
      tone(ac, { freq: 140, dur: 0.06, type: "sine", vol: v(0.35), at: 0.12 });
      break;
    case "gunshot":
      noise(ac, { dur: 0.05, vol: v(0.9), freq: 2500, q: 0.4, type: "lowpass" });
      noise(ac, { dur: 0.45, vol: v(0.5), freq: 700, q: 0.6, type: "lowpass", at: 0.02 });
      tone(ac, { freq: 160, to: 40, dur: 0.3, type: "sine", vol: v(0.5) });
      break;
    case "axe":
      noise(ac, { dur: 0.25, vol: v(0.25), freq: 2200, q: 1.5, at: 0 });
      tone(ac, { freq: 900, to: 300, dur: 0.22, type: "sawtooth", vol: v(0.06) });
      noise(ac, { dur: 0.12, vol: v(0.7), freq: 500, q: 1, at: 0.22 });
      tone(ac, { freq: 110, to: 60, dur: 0.2, type: "sine", vol: v(0.4), at: 0.22 });
      break;
    case "fall":
      tone(ac, { freq: 90, to: 45, dur: 0.25, type: "sine", vol: v(0.45) });
      noise(ac, { dur: 0.2, vol: v(0.3), freq: 300, q: 0.8 });
      break;
    case "march":
      for (let i = 0; i < 4; i += 1) noise(ac, { dur: 0.06, vol: v(0.25), freq: 350, q: 1.2, at: i * 0.22 });
      break;
    case "levelup":
      notes(ac, [523, 659, 784, 1047, 1319], 0.08, { type: "square", vol: v(0.07) });
      notes(ac, [1047, 1568], 0.2, { type: "triangle", vol: v(0.2), at: 0.45 });
      break;
    case "reward":
      notes(ac, [880, 1109, 1319, 1760], 0.06, { type: "sine", vol: v(0.2) });
      for (let i = 0; i < 6; i += 1) tone(ac, { freq: 2000 + i * 300, dur: 0.05, type: "sine", vol: v(0.05), at: 0.25 + i * 0.05 });
      break;
  }
}

export function haptic(ms = 12) {
  if (muted) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
