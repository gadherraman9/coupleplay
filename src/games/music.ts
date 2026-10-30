// Soft generated background music for game tables: a slow chord pad with a
// gentle pentatonic melody on top. No audio files; on/off is remembered.
import { isMuted, onMuteChange } from "./sfx";

const KEY = "cp_music_off";
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let wanted = false;
let off = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<(on: boolean) => void>();

// I–vi–IV–V in C, as MIDI notes.
const CHORDS = [
  [48, 55, 60, 64],
  [45, 52, 57, 60],
  [41, 48, 53, 57],
  [43, 50, 55, 59],
];
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);
const BEAT = 0.42;

function note(freq: number, at: number, dur: number, vol: number, type: OscillatorType) {
  if (!ctx || !out) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.4, dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function bar() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  const chord = CHORDS[step % CHORDS.length];
  chord.forEach((n) => note(hz(n), t, BEAT * 8, 0.035, "triangle"));
  note(hz(chord[0] - 12), t, BEAT * 4, 0.06, "sine");
  note(hz(chord[0] - 12), t + BEAT * 4, BEAT * 4, 0.05, "sine");
  for (let i = 0; i < 8; i += 1) {
    if (Math.random() < 0.55) {
      const n = SCALE[Math.floor(Math.random() * SCALE.length)];
      note(hz(n), t + i * BEAT, BEAT * 1.6, 0.03, "sine");
    }
  }
  step += 1;
}

function sync() {
  const play = wanted && !off && !isMuted();
  if (play && timer === null) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (!out) {
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(ctx.destination);
    }
    void ctx.resume();
    bar();
    timer = window.setInterval(bar, BEAT * 8 * 1000);
  } else if (!play && timer !== null) {
    window.clearInterval(timer);
    timer = null;
    void ctx?.suspend();
  }
}

if (typeof window !== "undefined") {
  onMuteChange(() => sync());
  // Browsers start audio only after a tap.
  window.addEventListener("pointerdown", () => sync());
}

export function startMusic() {
  wanted = true;
  sync();
}

export function stopMusic() {
  wanted = false;
  sync();
}

export const isMusicOn = () => !off;

export function setMusicOn(on: boolean) {
  off = !on;
  try {
    localStorage.setItem(KEY, off ? "1" : "0");
  } catch {
    /* storage blocked */
  }
  listeners.forEach((fn) => fn(on));
  sync();
}

export function onMusicChange(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
