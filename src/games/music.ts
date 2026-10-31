// Generated background music for game tables. Each board/table theme has its
// own tune: chords, tempo, instruments and drums (no audio files). On/off is
// remembered.
import { useEffect } from "react";
import { isMuted, onMuteChange, setSfxTheme } from "./sfx";
import type { SoundTheme } from "../skins";

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

interface Tune {
  beat: number; // seconds per beat, 8 beats per bar
  chords: number[][]; // MIDI notes, one chord per bar
  scale: number[]; // melody notes
  pad: OscillatorType;
  padVol: number;
  lead: OscillatorType;
  leadVol: number;
  // "random" picks scale notes, "arp" runs up and down the chord.
  melody: "random" | "arp";
  density: number; // chance of a melody note per step
  pluck?: boolean; // short, plucked notes (marimba, harpsichord, music box)
  bass?: "long" | "walk" | "none";
  // Steps spread over the bar: k kick, s snare, h hat, t tom, d doumbek, c shaker, . rest
  drums?: string;
  waves?: boolean; // ocean swell noise
}

const C_POP = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]];

const TUNES: Record<SoundTheme, Tune> = {
  classic: { beat: 0.42, chords: C_POP, scale: [60, 62, 64, 67, 69, 72, 74, 76], pad: "triangle", padVol: 0.035, lead: "sine", leadVol: 0.03, melody: "random", density: 0.55, bass: "long" },
  battle: { beat: 0.3, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], scale: [62, 65, 67, 69, 72, 74], pad: "sawtooth", padVol: 0.012, lead: "square", leadVol: 0.018, melody: "arp", density: 0.4, bass: "long", drums: "k.s.k.s.k.ssk.s." },
  royal: { beat: 0.36, chords: [[50, 57, 62, 66], [55, 59, 62, 67], [57, 61, 64, 69], [50, 57, 62, 66]], scale: [62, 64, 66, 67, 69, 71, 73, 74], pad: "triangle", padVol: 0.02, lead: "sawtooth", leadVol: 0.016, melody: "arp", density: 0.9, pluck: true, bass: "long" },
  space: { beat: 0.3, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]], scale: [69, 72, 74, 76, 79, 81], pad: "sawtooth", padVol: 0.01, lead: "square", leadVol: 0.014, melody: "arp", density: 0.85, pluck: true, bass: "long", drums: "k...h...k.k.h..." },
  jungle: { beat: 0.3, chords: [[45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 53, 57], [43, 50, 55, 62]], scale: [57, 60, 62, 64, 67, 69, 72], pad: "sine", padVol: 0.02, lead: "sine", leadVol: 0.06, melody: "random", density: 0.6, pluck: true, bass: "none", drums: "t.tt.t..t.t.tt.c" },
  candy: { beat: 0.34, chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], scale: [72, 74, 76, 79, 81, 84, 86, 88], pad: "sine", padVol: 0.015, lead: "sine", leadVol: 0.05, melody: "arp", density: 0.8, pluck: true, bass: "none" },
  ocean: { beat: 0.55, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], scale: [62, 64, 66, 69, 71, 74], pad: "sine", padVol: 0.04, lead: "triangle", leadVol: 0.025, melody: "random", density: 0.35, bass: "long", waves: true },
  spooky: { beat: 0.5, chords: [[45, 48, 51, 57], [44, 48, 51, 56], [41, 45, 48, 53], [40, 44, 47, 52]], scale: [57, 58, 60, 63, 64, 66, 69], pad: "square", padVol: 0.012, lead: "triangle", leadVol: 0.03, melody: "random", density: 0.4, bass: "long", drums: "k.......k...s..." },
  desert: { beat: 0.32, chords: [[52, 59, 64, 68], [53, 57, 60, 65], [52, 59, 64, 68], [50, 57, 62, 65]], scale: [64, 65, 68, 69, 71, 72, 74, 76], pad: "triangle", padVol: 0.018, lead: "sawtooth", leadVol: 0.014, melody: "random", density: 0.65, pluck: true, bass: "long", drums: "d..td.t.d..td.tt" },
  snow: { beat: 0.45, chords: [[50, 57, 62, 64], [47, 54, 59, 62], [55, 62, 67, 69], [57, 64, 69, 71]], scale: [74, 76, 78, 81, 83, 86], pad: "sine", padVol: 0.03, lead: "sine", leadVol: 0.045, melody: "random", density: 0.45, pluck: true, bass: "long", drums: "..c...c...c...c." },
  lounge: { beat: 0.38, chords: [[50, 53, 57, 60], [43, 53, 59, 62], [48, 52, 55, 59], [45, 49, 55, 57]], scale: [60, 62, 63, 65, 67, 69, 70, 72], pad: "triangle", padVol: 0.025, lead: "sine", leadVol: 0.03, melody: "random", density: 0.4, bass: "walk", drums: "h.hh.hh.h.hh.hh." },
};

let theme: SoundTheme = "classic";
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

function note(freq: number, at: number, dur: number, vol: number, type: OscillatorType, pluck = false) {
  if (!ctx || !out) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + (pluck ? 0.008 : Math.min(0.4, dur / 3)));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function hit(at: number, dur: number, vol: number, freq: number, filter: BiquadFilterType, q = 1) {
  if (!ctx || !out) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.01 + dur / 3, 1));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(gain).connect(out);
  src.start(at, Math.random() * 2);
  src.stop(at + dur + 0.05);
}

function drum(kind: string, at: number) {
  if (!ctx || !out) return;
  const sweep = (from: number, to: number, dur: number, vol: number) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(out!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };
  if (kind === "k") sweep(120, 45, 0.25, 0.22);
  else if (kind === "s") hit(at, 0.14, 0.09, 1800, "bandpass", 0.6);
  else if (kind === "h") hit(at, 0.04, 0.035, 7000, "highpass");
  else if (kind === "t") sweep(190, 110, 0.22, 0.16);
  else if (kind === "d") sweep(260, 140, 0.12, 0.14);
  else if (kind === "c") hit(at, 0.08, 0.04, 5000, "bandpass", 2);
}

function bar() {
  if (!ctx) return;
  const tune = TUNES[theme];
  const B = tune.beat;
  const t = ctx.currentTime + 0.05;
  const chord = tune.chords[step % tune.chords.length];
  chord.forEach((n) => note(hz(n), t, B * 8, tune.padVol, tune.pad));
  if (tune.bass === "long") {
    note(hz(chord[0] - 12), t, B * 4, 0.06, "sine");
    note(hz(chord[0] - 12), t + B * 4, B * 4, 0.05, "sine");
  } else if (tune.bass === "walk") {
    [0, 4, 7, 9, 12, 9, 7, 4].forEach((s, i) => note(hz(chord[0] - 12 + s), t + i * B, B * 0.9, 0.05, "triangle", true));
  }
  const up = chord.map((n) => n + 12);
  const melodyNotes = tune.melody === "arp" ? [...up, ...[...up].reverse()] : tune.scale;
  const steps = tune.pluck ? 16 : 8;
  const len = (B * 8) / steps;
  for (let i = 0; i < steps; i += 1) {
    if (Math.random() >= tune.density) continue;
    const n = tune.melody === "arp" ? melodyNotes[i % melodyNotes.length] : melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
    note(hz(n), t + i * len, tune.pluck ? len * 2.2 : len * 1.6, tune.leadVol, tune.lead, tune.pluck);
  }
  if (tune.drums) {
    const d = tune.drums;
    for (let i = 0; i < d.length; i += 1) if (d[i] !== ".") drum(d[i], t + (i * B * 8) / d.length);
  }
  if (tune.waves) {
    hit(t, B * 4, 0.05, 500, "lowpass");
    hit(t + B * 4, B * 4, 0.04, 400, "lowpass");
  }
  step += 1;
}

// Bars are scheduled one at a time so a theme change picks up the new tempo.
function schedule() {
  timer = window.setTimeout(() => {
    bar();
    schedule();
  }, TUNES[theme].beat * 8 * 1000);
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
    schedule();
  } else if (!play && timer !== null) {
    window.clearTimeout(timer);
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

export function setSoundTheme(next: SoundTheme = "classic") {
  if (next === theme) return;
  theme = next;
  step = 0;
  setSfxTheme(next);
}

// A board or table view calls this with its skin's theme; leaving resets it.
export function useSoundTheme(next?: SoundTheme) {
  useEffect(() => {
    setSoundTheme(next ?? "classic");
    return () => setSoundTheme("classic");
  }, [next]);
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
