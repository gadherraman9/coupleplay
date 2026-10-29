import type { CSSProperties } from "react";

export interface AppTheme {
  id: string;
  name: string;
  price: number;
  swatch: string;
  vars: Record<string, string>;
  dark?: boolean;
}

export interface ChatTheme {
  id: string;
  name: string;
  price: number;
  background: string;
  mine: string;
  theirs: string;
  theirsText?: string;
  pattern?: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: "rose",
    name: "Rose",
    price: 0,
    swatch: "linear-gradient(135deg, #ec4899, #a855f7)",
    vars: {},
  },
  {
    id: "ocean",
    name: "Ocean",
    price: 60,
    swatch: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    vars: { "--pink-500": "#0ea5e9", "--pink-600": "#0284c7", "--pink-400": "#38bdf8", "--pink-100": "#e0f2fe", "--violet-500": "#6366f1", "--cream": "#f5faff", "--ink": "#13294b", "--ink-soft": "#4b6585" },
  },
  {
    id: "sunset",
    name: "Sunset",
    price: 80,
    swatch: "linear-gradient(135deg, #f97316, #e11d48)",
    vars: { "--pink-500": "#f97316", "--pink-600": "#ea580c", "--pink-400": "#fb923c", "--pink-100": "#ffedd5", "--violet-500": "#e11d48", "--cream": "#fffaf5", "--ink": "#43201a", "--ink-soft": "#80503f" },
  },
  {
    id: "mint",
    name: "Mint",
    price: 80,
    swatch: "linear-gradient(135deg, #10b981, #0ea5e9)",
    vars: { "--pink-500": "#10b981", "--pink-600": "#059669", "--pink-400": "#34d399", "--pink-100": "#d1fae5", "--violet-500": "#0ea5e9", "--cream": "#f5fffb", "--ink": "#123a30", "--ink-soft": "#4a7166" },
  },
  {
    id: "midnight",
    name: "Midnight",
    price: 150,
    dark: true,
    swatch: "linear-gradient(135deg, #1e1b4b, #7c3aed)",
    vars: { "--pink-500": "#a78bfa", "--pink-600": "#8b5cf6", "--pink-400": "#c4b5fd", "--pink-100": "#2e2a55", "--violet-500": "#ec4899", "--cream": "#14122b", "--ink": "#f1edff", "--ink-soft": "#c2bbe6", "--muted": "#8f88b8", "--line": "rgba(196, 181, 253, 0.16)" },
  },
  {
    id: "gold",
    name: "Royal Gold",
    price: 250,
    swatch: "linear-gradient(135deg, #f59e0b, #b45309)",
    vars: { "--pink-500": "#d97706", "--pink-600": "#b45309", "--pink-400": "#f59e0b", "--pink-100": "#fef3c7", "--violet-500": "#9a3412", "--cream": "#fffbf0", "--ink": "#3b2506", "--ink-soft": "#7c5a26" },
  },
];

export const CHAT_THEMES: ChatTheme[] = [
  { id: "classic", name: "Classic", price: 0, background: "linear-gradient(180deg, #fff8fc, #fdf2f8)", mine: "linear-gradient(135deg, #ec4899, #d946ef)", theirs: "#ffffff" },
  { id: "hearts", name: "Love Letters", price: 40, background: "#ffe4ef", pattern: "radial-gradient(circle at 20px 20px, rgba(244, 114, 182, 0.25) 6px, transparent 7px)", mine: "linear-gradient(135deg, #e11d48, #f43f5e)", theirs: "#fff7fa" },
  { id: "galaxy", name: "Galaxy", price: 90, background: "radial-gradient(circle at 30% 20%, #4c1d95, #0f0a2a 70%)", pattern: "radial-gradient(1.5px 1.5px at 12px 18px, #fff 50%, transparent 51%), radial-gradient(1px 1px at 40px 50px, #e9d5ff 50%, transparent 51%)", mine: "linear-gradient(135deg, #8b5cf6, #ec4899)", theirs: "rgba(255,255,255,0.12)", theirsText: "#f5f3ff" },
  { id: "beach", name: "Beach Day", price: 60, background: "linear-gradient(180deg, #bae6fd 0%, #e0f2fe 55%, #fde68a 100%)", mine: "linear-gradient(135deg, #0284c7, #06b6d4)", theirs: "#fffdf5" },
  { id: "neon", name: "Neon Night", price: 120, background: "#0b0b12", pattern: "linear-gradient(rgba(34, 211, 238, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(236, 72, 153, 0.08) 1px, transparent 1px)", mine: "linear-gradient(135deg, #22d3ee, #a855f7)", theirs: "#1c1c2b", theirsText: "#e0f7ff" },
  { id: "paper", name: "Love Diary", price: 50, background: "#fffaf0", pattern: "linear-gradient(rgba(180, 140, 100, 0.12) 1px, transparent 1px)", mine: "linear-gradient(135deg, #b45309, #d97706)", theirs: "#ffffff" },
];

export function appThemeStyle(id: string): CSSProperties {
  const theme = APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0];
  return theme.vars as CSSProperties;
}

export function chatThemeStyle(id: string): CSSProperties {
  const theme = CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];
  return {
    "--chat-bg": theme.pattern ? `${theme.pattern}, ${theme.background}` : theme.background,
    "--chat-bg-size": theme.pattern ? "48px 48px, 48px 48px, auto" : "auto",
    "--bubble-mine": theme.mine,
    "--bubble-theirs": theme.theirs,
    "--bubble-theirs-text": theme.theirsText ?? "var(--ink)",
  } as CSSProperties;
}

export function isDarkTheme(id: string) {
  return Boolean(APP_THEMES.find((t) => t.id === id)?.dark);
}
