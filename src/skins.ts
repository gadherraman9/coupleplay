// Game skins: board looks for Ludo and Snakes & Ladders, dice, goti (tokens),
// card backs and table colours. Artwork lives in src/assets/skins (made with
// Gemini); a skin whose picture is missing falls back to its colours.
import { useCallback, useSyncExternalStore } from "react";
import { useApp } from "./context";

export type SkinKind = "ludo" | "snakes" | "dice" | "token" | "cards" | "table";

// Background music and sound flavour that comes with a board or table.
export type SoundTheme = "classic" | "battle" | "royal" | "space" | "jungle" | "candy" | "ocean" | "spooky" | "desert" | "snow" | "lounge";

export type TokenColor = "red" | "green" | "yellow" | "blue";

export interface DiceLook {
  face: string; // CSS background of the die
  pip: string; // pip colour
  shape?: "dot" | "heart" | "star" | "skull" | "paw" | "flame" | "diamond" | "flower" | "snow" | "moon";
  edge?: string; // outline colour
  glow?: string; // glow colour around the pips
}

export interface SnakeLook {
  // Body colour pairs, one per snake (body, belly/markings).
  colors: [string, string][];
  pattern: "diamond" | "bands" | "spots" | "stripes" | "glow";
  ladder: "wood" | "metal" | "candy" | "rope" | "ice" | "gold" | "bone";
}

export interface Skin {
  id: string;
  kind: SkinKind;
  name: string;
  price: number;
  blurb: string;
  // File names in src/assets/skins.
  board?: string;
  back?: string;
  felt?: string;
  preview?: string;
  // Ludo: how the four pieces look.
  pieces?: "pawn" | "soldier";
  // Snakes: square colours drawn over the board picture, the snake/ladder
  // look, and which snakes-and-ladders layout the theme plays on.
  cells?: string[];
  snakes?: SnakeLook;
  layout?: string;
  // Board/table background when there's no picture (any CSS background).
  tint?: string;
  bg?: string;
  sound?: SoundTheme;
  // Dice look.
  dice?: DiceLook;
  // Goti: picture per colour (tok-<pack>-<colour>.webp) or emoji fallback.
  pack?: string;
  emoji?: Record<TokenColor, string>;
  // Card back drawn in CSS when there's no picture.
  backCss?: string;
  // Validated local-device photo only. Never persisted in User / profile data.
  customBack?: string;
}

const files = import.meta.glob("./assets/skins/*.{webp,png,jpg}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export function skinArt(name?: string) {
  if (!name) return undefined;
  return files[`./assets/skins/${name}`];
}

const tok = (red: string, green: string, yellow: string, blue: string) => ({ red, green, yellow, blue });

// Card back patterns drawn in CSS.
const diamondBack = (a: string, b: string, line = "rgba(255,255,255,.35)") =>
  `repeating-linear-gradient(45deg, ${line} 0 2px, transparent 2px 12px), repeating-linear-gradient(-45deg, ${line} 0 2px, transparent 2px 12px), linear-gradient(135deg, ${a}, ${b})`;
const stripeBack = (a: string, b: string) => `repeating-linear-gradient(90deg, ${a} 0 6px, ${b} 6px 12px)`;
const dotBack = (a: string, b: string, dot = "rgba(255,255,255,.4)") => `radial-gradient(${dot} 2px, transparent 2.5px) 0 0 / 10px 10px, linear-gradient(160deg, ${a}, ${b})`;
const felt = (c: string) => `radial-gradient(ellipse at 50% 40%, ${c} 0%, color-mix(in srgb, ${c} 35%, #000) 100%)`;

export const SKINS: Skin[] = [
  // ---------- Ludo boards ----------
  { id: "ludo-classic", kind: "ludo", name: "Classic", price: 0, blurb: "The board you know", sound: "classic" },
  { id: "ludo-battle", kind: "ludo", name: "Battle", price: 200, blurb: "Four armies. Captures are shoot-outs!", pieces: "soldier", board: "ludo-battle.webp", preview: "ludo-battle-preview.webp", tint: "#4d5b2c", sound: "battle" },
  { id: "ludo-royal", kind: "ludo", name: "Royal Palace", price: 120, blurb: "Marble, gold and palace music", board: "ludo-royal.webp", tint: "#d8c9a3", sound: "royal" },
  { id: "ludo-space", kind: "ludo", name: "Galaxy", price: 120, blurb: "Race across the stars to synth beats", board: "ludo-space.webp", tint: "#1b1640", sound: "space" },
  { id: "ludo-jungle", kind: "ludo", name: "Jungle", price: 120, blurb: "Tribal drums and wild leaves", board: "snakes-jungle.webp", tint: "#1f5a2a", bg: "radial-gradient(circle at 20% 20%, #4ade80 0 8%, transparent 9%), radial-gradient(circle at 80% 70%, #22c55e 0 10%, transparent 11%), linear-gradient(135deg, #14532d, #3f6212)", sound: "jungle" },
  { id: "ludo-ocean", kind: "ludo", name: "Ocean", price: 120, blurb: "Waves, bubbles and sea music", board: "snakes-ocean.webp", tint: "#0e4a6e", bg: "radial-gradient(circle at 30% 20%, rgba(255,255,255,.25) 0 3%, transparent 4%), radial-gradient(circle at 70% 60%, rgba(255,255,255,.2) 0 2%, transparent 3%), linear-gradient(180deg, #38bdf8, #0c4a6e)", sound: "ocean" },
  { id: "ludo-spooky", kind: "ludo", name: "Haunted", price: 150, blurb: "Zombie night with spooky organ", board: "snakes-spooky.webp", tint: "#1c1030", bg: "radial-gradient(circle at 75% 18%, #fef3c7 0 7%, transparent 8%), linear-gradient(180deg, #312e81, #0f0a1e)", sound: "spooky" },
  { id: "ludo-candy", kind: "ludo", name: "Candy", price: 100, blurb: "Sweet board with music-box tunes", board: "snakes-candy.webp", tint: "#f9a8d4", bg: "repeating-linear-gradient(45deg, #fbcfe8 0 14px, #fdf2f8 14px 28px)", sound: "candy" },

  // ---------- Snakes & Ladders boards (each has its own layout) ----------
  { id: "snakes-classic", kind: "snakes", name: "Classic", price: 0, blurb: "Bright and simple", layout: "classic", sound: "classic",
    snakes: { colors: [["#16a34a", "#bef264"], ["#dc2626", "#fde047"], ["#7c3aed", "#f0abfc"], ["#ea580c", "#fef08a"], ["#0891b2", "#a5f3fc"]], pattern: "bands", ladder: "wood" } },
  { id: "snakes-jungle", kind: "snakes", name: "Jungle", price: 90, blurb: "Pythons, vines and jungle drums", board: "snakes-jungle.webp", tint: "#2f6b2a", cells: ["rgba(254,243,199,.55)", "rgba(187,247,208,.55)"], layout: "jungle", sound: "jungle",
    snakes: { colors: [["#3f6212", "#d9f99d"], ["#854d0e", "#fde68a"], ["#166534", "#86efac"], ["#713f12", "#fcd34d"]], pattern: "diamond", ladder: "rope" } },
  { id: "snakes-space", kind: "snakes", name: "Outer Space", price: 120, blurb: "Neon serpents and rocket ladders", board: "snakes-space.webp", tint: "#1e1b4b", cells: ["rgba(30,27,75,.45)", "rgba(91,33,182,.4)"], layout: "space", sound: "space",
    snakes: { colors: [["#22d3ee", "#a5f3fc"], ["#e879f9", "#fae8ff"], ["#a3e635", "#ecfccb"], ["#fb7185", "#ffe4e6"]], pattern: "glow", ladder: "metal" } },
  { id: "snakes-candy", kind: "snakes", name: "Candy Land", price: 90, blurb: "Candy-cane ladders, gummy snakes", board: "snakes-candy.webp", tint: "#f9a8d4", cells: ["rgba(255,255,255,.55)", "rgba(251,207,232,.55)"], layout: "candy", sound: "candy",
    snakes: { colors: [["#ec4899", "#fff"], ["#8b5cf6", "#fde68a"], ["#f97316", "#fff7ed"], ["#14b8a6", "#ccfbf1"]], pattern: "stripes", ladder: "candy" } },
  { id: "snakes-desert", kind: "snakes", name: "Egypt Desert", price: 120, blurb: "Cobras of the pyramids", board: "snakes-desert.webp", tint: "#c2884a", bg: "linear-gradient(180deg, #fde68a, #d97706)", cells: ["rgba(254,243,199,.6)", "rgba(253,186,116,.5)"], layout: "desert", sound: "desert",
    snakes: { colors: [["#a16207", "#fef3c7"], ["#78350f", "#fbbf24"], ["#1c1917", "#facc15"], ["#9a3412", "#fed7aa"]], pattern: "bands", ladder: "gold" } },
  { id: "snakes-ocean", kind: "snakes", name: "Deep Ocean", price: 120, blurb: "Sea serpents and rope ladders", board: "snakes-ocean.webp", tint: "#0e4a6e", bg: "linear-gradient(180deg, #67e8f9, #0c4a6e)", cells: ["rgba(207,250,254,.5)", "rgba(125,211,252,.45)"], layout: "ocean", sound: "ocean",
    snakes: { colors: [["#0369a1", "#bae6fd"], ["#0f766e", "#99f6e4"], ["#1d4ed8", "#fde047"], ["#4338ca", "#c7d2fe"]], pattern: "spots", ladder: "rope" } },
  { id: "snakes-spooky", kind: "snakes", name: "Haunted", price: 150, blurb: "Zombie snakes, bone ladders", board: "snakes-spooky.webp", tint: "#1c1030", bg: "radial-gradient(circle at 80% 12%, #fef3c7 0 6%, transparent 7%), linear-gradient(180deg, #4c1d95, #0f0a1e)", cells: ["rgba(76,29,149,.45)", "rgba(30,27,75,.5)"], layout: "spooky", sound: "spooky",
    snakes: { colors: [["#4d7c0f", "#a3e635"], ["#581c87", "#f0abfc"], ["#18181b", "#f97316"], ["#7f1d1d", "#fca5a5"]], pattern: "spots", ladder: "bone" } },
  { id: "snakes-snow", kind: "snakes", name: "Snow Peak", price: 100, blurb: "Ice ladders and frosty snakes", board: "snakes-snow.webp", tint: "#bfdbfe", bg: "linear-gradient(180deg, #f0f9ff, #93c5fd)", cells: ["rgba(255,255,255,.6)", "rgba(219,234,254,.6)"], layout: "snow", sound: "snow",
    snakes: { colors: [["#1e40af", "#e0f2fe"], ["#475569", "#f1f5f9"], ["#0e7490", "#cffafe"], ["#6d28d9", "#ede9fe"]], pattern: "diamond", ladder: "ice" } },

  // ---------- Dice ----------
  { id: "dice-3d", kind: "dice", name: "Classic 3D", price: 0, blurb: "Shiny real dice" },
  { id: "dice-pearl", kind: "dice", name: "Pearl White", price: 0, blurb: "Clean and simple", dice: { face: "linear-gradient(145deg, #fff, #fdf2f8 60%, #f5e1ee)", pip: "#be185d" } },
  { id: "dice-ruby", kind: "dice", name: "Ruby", price: 60, blurb: "Deep red gem", dice: { face: "linear-gradient(145deg, #fb7185, #be123c 55%, #7f1d1d)", pip: "#fff", edge: "#fecdd3" } },
  { id: "dice-emerald", kind: "dice", name: "Emerald", price: 60, blurb: "Green gemstone", dice: { face: "linear-gradient(145deg, #6ee7b7, #059669 55%, #064e3b)", pip: "#fff", edge: "#a7f3d0" } },
  { id: "dice-sapphire", kind: "dice", name: "Sapphire", price: 60, blurb: "Ocean blue gem", dice: { face: "linear-gradient(145deg, #93c5fd, #2563eb 55%, #1e3a8a)", pip: "#fff", edge: "#bfdbfe" } },
  { id: "dice-gold", kind: "dice", name: "Solid Gold", price: 150, blurb: "Rich and shiny", dice: { face: "linear-gradient(145deg, #fef08a, #eab308 45%, #a16207 80%, #fde047)", pip: "#422006", edge: "#fef9c3" } },
  { id: "dice-obsidian", kind: "dice", name: "Black Gold", price: 120, blurb: "Black stone, gold dots", dice: { face: "linear-gradient(145deg, #3f3f46, #09090b)", pip: "#facc15", edge: "#a16207", glow: "#facc15" } },
  { id: "dice-neon", kind: "dice", name: "Neon", price: 100, blurb: "Glows in the dark", dice: { face: "linear-gradient(145deg, #1e1b4b, #020617)", pip: "#22d3ee", edge: "#22d3ee", glow: "#22d3ee" } },
  { id: "dice-love", kind: "dice", name: "Love", price: 80, blurb: "Hearts instead of dots", dice: { face: "linear-gradient(145deg, #fff, #ffe4e6)", pip: "#e11d48", shape: "heart", edge: "#fda4af" } },
  { id: "dice-candy", kind: "dice", name: "Candy", price: 80, blurb: "Bubblegum pink with flowers", dice: { face: "linear-gradient(145deg, #f9a8d4, #ec4899)", pip: "#fff", shape: "flower", edge: "#fbcfe8" } },
  { id: "dice-stars", kind: "dice", name: "Starry Night", price: 100, blurb: "Golden stars on navy", dice: { face: "linear-gradient(145deg, #312e81, #0f172a)", pip: "#fde047", shape: "star", edge: "#6366f1", glow: "#fde047" } },
  { id: "dice-zombie", kind: "dice", name: "Zombie", price: 120, blurb: "Rotten green with skulls", dice: { face: "radial-gradient(circle at 30% 70%, #3f6212 0 18%, transparent 19%), linear-gradient(145deg, #a3e635, #4d7c0f)", pip: "#1a2e05", shape: "skull", edge: "#365314" } },
  { id: "dice-paws", kind: "dice", name: "Paw Prints", price: 80, blurb: "For animal lovers", dice: { face: "linear-gradient(145deg, #fed7aa, #fb923c)", pip: "#7c2d12", shape: "paw", edge: "#fdba74" } },
  { id: "dice-fire", kind: "dice", name: "Fire", price: 120, blurb: "Hot lava dice", dice: { face: "linear-gradient(160deg, #fde047, #f97316 45%, #b91c1c)", pip: "#fff7ed", shape: "flame", edge: "#fed7aa", glow: "#f97316" } },
  { id: "dice-ice", kind: "dice", name: "Ice Cube", price: 100, blurb: "Frozen and frosty", dice: { face: "linear-gradient(145deg, rgba(255,255,255,.95), #bae6fd 55%, #7dd3fc)", pip: "#0369a1", shape: "snow", edge: "#e0f2fe" } },
  { id: "dice-wood", kind: "dice", name: "Wooden", price: 60, blurb: "Hand-carved oak", dice: { face: "repeating-linear-gradient(100deg, rgba(0,0,0,.08) 0 3px, transparent 3px 9px), linear-gradient(145deg, #d6a46b, #92400e)", pip: "#3b1d0a", edge: "#fcd9a8" } },
  { id: "dice-galaxy", kind: "dice", name: "Galaxy", price: 150, blurb: "Moons on a purple galaxy", dice: { face: "radial-gradient(circle at 20% 25%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 70% 80%, #fff 0 1px, transparent 1.5px), radial-gradient(circle at 60% 30%, #f0abfc 0 20%, transparent 50%), linear-gradient(145deg, #7c3aed, #1e1b4b)", pip: "#fff", shape: "moon", edge: "#c4b5fd", glow: "#e9d5ff" } },
  { id: "dice-diamond", kind: "dice", name: "Diamond", price: 200, blurb: "Crystal dice with gems", dice: { face: "conic-gradient(from 45deg, #f0f9ff, #c7d2fe, #f0f9ff, #bae6fd, #f0f9ff)", pip: "#4f46e5", shape: "diamond", edge: "#fff", glow: "#a5b4fc" } },

  // ---------- Goti (tokens) for Ludo and Snakes ----------
  { id: "token-pawn", kind: "token", name: "Classic Pawns", price: 0, blurb: "Shiny pawns", pack: "pawn" },
  { id: "token-animals", kind: "token", name: "Wild Animals", price: 100, blurb: "Fox, frog, lion and whale", pack: "animals", emoji: tok("🦊", "🐸", "🦁", "🐳") },
  { id: "token-zombies", kind: "token", name: "Zombies", price: 150, blurb: "Brains! Four zombie gotis", pack: "zombies", emoji: tok("🧟", "🧟‍♂️", "🧟‍♀️", "🧟") },
  { id: "token-girls", kind: "token", name: "Girls", price: 120, blurb: "Dancer, fairy, princess, mermaid", pack: "girls", emoji: tok("💃", "🧚‍♀️", "👸", "🧜‍♀️") },
  { id: "token-boys", kind: "token", name: "Boys", price: 120, blurb: "Hero, ninja, king, pilot", pack: "boys", emoji: tok("🦸‍♂️", "🥷", "🤴", "🧑‍✈️") },
  { id: "token-pets", kind: "token", name: "Cute Pets", price: 100, blurb: "Puppy, bunny, kitty, hamster", pack: "pets", emoji: tok("🐶", "🐰", "🐱", "🐹") },
  { id: "token-dinos", kind: "token", name: "Dinosaurs", price: 120, blurb: "Roaring T-rex gang", pack: "dinos", emoji: tok("🦖", "🦕", "🐲", "🐊") },
  { id: "token-monsters", kind: "token", name: "Halloween", price: 120, blurb: "Little devil, pumpkin, ghost, vampire", pack: "monsters", emoji: tok("😈", "🎃", "👻", "🧛") },
  { id: "token-robots", kind: "token", name: "Robots", price: 120, blurb: "Four beep-boop bots", pack: "robots", emoji: tok("🤖", "🤖", "🤖", "🤖") },
  { id: "token-space", kind: "token", name: "Space", price: 100, blurb: "Rocket, alien, astronaut, UFO", pack: "space", emoji: tok("🚀", "👽", "🧑‍🚀", "🛸") },
  { id: "token-cars", kind: "token", name: "Racing Cars", price: 100, blurb: "Vroom to home", pack: "cars", emoji: tok("🏎️", "🚜", "🚕", "🚓") },
  { id: "token-food", kind: "token", name: "Yummy Food", price: 80, blurb: "Strawberry, avocado, lemon, berry", pack: "food", emoji: tok("🍓", "🥑", "🍋", "🫐") },
  { id: "token-love", kind: "token", name: "Love Hearts", price: 80, blurb: "For couples", pack: "love", emoji: tok("❤️", "💚", "💛", "💙") },
  { id: "token-pirates", kind: "token", name: "Pirates", price: 120, blurb: "Captain, parrot, gold girl, sailor", pack: "pirates", emoji: tok("🏴‍☠️", "🦜", "🪙", "⚓") },

  // ---------- Card backs ----------
  { id: "cards-classic", kind: "cards", name: "Classic Blue", price: 0, blurb: "Casino card back", back: "back-classic.webp", felt: "felt-green.webp", tint: "#17663a" },
  { id: "cards-royal", kind: "cards", name: "Royal Red", price: 100, blurb: "Red velvet and gold", back: "back-royal.webp", felt: "felt-red.webp", tint: "#7f1d1d" },
  { id: "cards-midnight", kind: "cards", name: "Midnight", price: 100, blurb: "Deep blue night", back: "back-midnight.webp", felt: "felt-blue.webp", tint: "#172554" },
  { id: "cards-wood", kind: "cards", name: "Golden", price: 150, blurb: "Golden cards", back: "back-gold.webp", felt: "felt-wood.webp", tint: "#5b3416" },
  { id: "back-ruby", kind: "cards", name: "Ruby Red", price: 50, blurb: "Red diamonds", backCss: diamondBack("#ef4444", "#7f1d1d") },
  { id: "back-emerald", kind: "cards", name: "Emerald", price: 50, blurb: "Green diamonds", backCss: diamondBack("#22c55e", "#14532d") },
  { id: "back-ocean", kind: "cards", name: "Ocean Blue", price: 50, blurb: "Blue diamonds", backCss: diamondBack("#38bdf8", "#1e3a8a") },
  { id: "back-purple", kind: "cards", name: "Royal Purple", price: 50, blurb: "Purple diamonds", backCss: diamondBack("#a855f7", "#3b0764") },
  { id: "back-pink", kind: "cards", name: "Rose Pink", price: 50, blurb: "Pink polka dots", backCss: dotBack("#f472b6", "#9d174d") },
  { id: "back-orange", kind: "cards", name: "Sunset", price: 50, blurb: "Orange polka dots", backCss: dotBack("#fb923c", "#9a3412") },
  { id: "back-teal", kind: "cards", name: "Teal Stripes", price: 50, blurb: "Cool teal stripes", backCss: stripeBack("#0d9488", "#115e59") },
  { id: "back-black", kind: "cards", name: "Black Gold", price: 80, blurb: "Black with gold lines", backCss: diamondBack("#27272a", "#09090b", "rgba(250,204,21,.45)") },
  { id: "back-love", kind: "cards", name: "Love Pink", price: 80, blurb: "Pink with white dots", backCss: dotBack("#fb7185", "#be185d", "rgba(255,255,255,.7)") },
  { id: "back-rainbow", kind: "cards", name: "Rainbow", price: 80, blurb: "All the colours", backCss: "linear-gradient(135deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7)" },
  { id: "back-spring", kind: "cards", name: "Spring Petals", price: 80, blurb: "Soft blossoms on sage", backCss: "radial-gradient(ellipse at 35% 35%, #fbcfe8 0 3px, transparent 4px) 0 0 / 18px 22px, radial-gradient(ellipse at 65% 65%, #fce7f3 0 3px, transparent 4px) 0 0 / 18px 22px, linear-gradient(145deg, #527b66, #234838)" },
  { id: "back-diwali", kind: "cards", name: "Diwali Glow", price: 80, blurb: "Golden lattice and warm lamplight", backCss: diamondBack("#923a3a", "#431b32", "rgba(253,211,125,.65)") },
  { id: "back-winter", kind: "cards", name: "Winter Stars", price: 80, blurb: "Frosty starlight on midnight blue", backCss: dotBack("#315b7b", "#142d46", "rgba(224,242,254,.8)") },

  // ---------- Table colours ----------
  { id: "table-green", kind: "table", name: "Casino Green", price: 0, blurb: "Classic green felt", felt: "felt-green.webp", tint: "#17663a", sound: "lounge" },
  { id: "table-red", kind: "table", name: "Red Velvet", price: 80, blurb: "Rich red felt", felt: "felt-red.webp", tint: "#7f1d1d", sound: "lounge" },
  { id: "table-blue", kind: "table", name: "Midnight Blue", price: 80, blurb: "Deep blue felt", felt: "felt-blue.webp", tint: "#172554", sound: "lounge" },
  { id: "table-wood", kind: "table", name: "Old Wood", price: 100, blurb: "Cosy wooden table", felt: "felt-wood.webp", tint: "#5b3416", sound: "lounge" },
  { id: "table-purple", kind: "table", name: "Royal Purple", price: 60, blurb: "Purple velvet", tint: "#581c87", bg: felt("#7e22ce"), sound: "royal" },
  { id: "table-teal", kind: "table", name: "Teal", price: 60, blurb: "Cool teal felt", tint: "#115e59", bg: felt("#0d9488"), sound: "ocean" },
  { id: "table-black", kind: "table", name: "VIP Black", price: 100, blurb: "Black and gold VIP room", tint: "#18181b", bg: "radial-gradient(ellipse at 50% 40%, #3f3f46 0%, #09090b 100%)", sound: "lounge" },
  { id: "table-pink", kind: "table", name: "Pink Love", price: 60, blurb: "Pink table for two", tint: "#9d174d", bg: felt("#db2777"), sound: "candy" },
  { id: "table-orange", kind: "table", name: "Sunset", price: 60, blurb: "Warm orange felt", tint: "#9a3412", bg: felt("#ea580c"), sound: "desert" },
  { id: "table-grey", kind: "table", name: "Slate", price: 60, blurb: "Modern grey", tint: "#334155", bg: felt("#64748b"), sound: "lounge" },
  { id: "table-space", kind: "table", name: "Galaxy", price: 120, blurb: "Play among the stars", tint: "#1e1b4b", bg: "radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 2px) 0 0 / 60px 60px, radial-gradient(circle at 70% 60%, #c4b5fd 0 1px, transparent 2px) 0 0 / 90px 90px, radial-gradient(ellipse at 50% 40%, #4c1d95 0%, #0f0a1e 100%)", sound: "space" },
  { id: "table-spring", kind: "table", name: "Spring Garden", price: 80, blurb: "A quiet sage-green garden", tint: "#294e3c", bg: felt("#63876b"), sound: "lounge" },
  { id: "table-diwali", kind: "table", name: "Diwali Velvet", price: 80, blurb: "Plum velvet with an amber glow", tint: "#4b2038", bg: "radial-gradient(ellipse at 50% 35%, #915447, #54263d 60%, #281324)", sound: "royal" },
  { id: "table-winter", kind: "table", name: "Winter Lodge", price: 80, blurb: "Deep blue felt for cosy games", tint: "#243c53", bg: felt("#4f718b"), sound: "snow" },
];

export const skinById = (id?: string) => SKINS.find((s) => s.id === id);

export function defaultSkin(kind: SkinKind) {
  return SKINS.find((s) => s.kind === kind && s.price === 0)!;
}

export function pickedSkin(skins: Partial<Record<string, string>> | undefined, kind: SkinKind): Skin {
  const skin = skinById(skins?.[kind]);
  return skin && skin.kind === kind ? skin : defaultSkin(kind);
}

// Photos have their own per-user device store, completely separate from the
// backend snapshot. Limit the entire ASCII data URL, including base64 overhead.
export const MAX_CARD_PHOTO_BYTES = 150 * 1024;
const PHOTO_PREFIX = "cp_card_back_v1:";
const photoListeners = new Set<() => void>();
const photoCache = new Map<string, { raw: string | null; photo: string | undefined }>();

export function isCardPhoto(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_CARD_PHOTO_BYTES) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    // Check the actual format too, not just a claimed MIME type. No SVG, remote
    // URL, quote or CSS syntax can reach the card's background image.
    const bytes = atob(match[2]);
    if (match[1] === "jpeg") return bytes.startsWith("\xff\xd8\xff");
    if (match[1] === "png") return bytes.startsWith("\x89PNG\r\n\x1a\n");
    return bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
  } catch {
    return false;
  }
}

export function readCustomCardBack(userId: string): string | undefined {
  try {
    const raw = window.localStorage.getItem(PHOTO_PREFIX + userId);
    const cached = photoCache.get(userId);
    if (cached?.raw === raw) return cached.photo;
    const photo = isCardPhoto(raw) ? raw : undefined;
    photoCache.set(userId, { raw, photo });
    return photo;
  } catch {
    return undefined;
  }
}

const emitPhotos = () => photoListeners.forEach((listener) => listener());
const onPhotoStorage = (event: StorageEvent) => {
  if (event.key === null || event.key.startsWith(PHOTO_PREFIX)) emitPhotos();
};

export function subscribeCustomCardBack(listener: () => void) {
  if (!photoListeners.size && typeof window !== "undefined") window.addEventListener("storage", onPhotoStorage);
  photoListeners.add(listener);
  return () => {
    photoListeners.delete(listener);
    if (!photoListeners.size && typeof window !== "undefined") window.removeEventListener("storage", onPhotoStorage);
  };
}

export function saveCustomCardBack(userId: string, photo?: string) {
  if (!userId) throw new Error("Sign in to choose a photo back.");
  if (photo !== undefined && !isCardPhoto(photo)) throw new Error("Choose a valid JPEG, PNG or WebP photo under 150 KB after resizing.");
  try {
    // A failed setItem leaves the old value intact. Notify subscribers only
    // after a successful write, so a quota error never replaces their photo.
    if (photo === undefined) window.localStorage.removeItem(PHOTO_PREFIX + userId);
    else window.localStorage.setItem(PHOTO_PREFIX + userId, photo);
  } catch {
    throw new Error("Couldn't save the photo setting on this device. Storage may be full or blocked; your previous back is unchanged.");
  }
  emitPhotos();
}

const noPhoto = () => undefined;
export function useCustomCardBack(userId?: string) {
  const snapshot = useCallback(() => userId ? readCustomCardBack(userId) : undefined, [userId]);
  return useSyncExternalStore(subscribeCustomCardBack, snapshot, noPhoto);
}

// The skin the person looking at the screen picked (each player sees their own).
export function useSkin(kind: SkinKind): Skin {
  const { me } = useApp();
  const photo = useCustomCardBack(kind === "cards" ? me.id : undefined);
  const skin = pickedSkin(me.skins, kind);
  return photo ? { ...skin, customBack: photo } : skin;
}

// Table look for card games: the picked table colour, or (for people who
// chose a card skin before tables existed) that skin's felt.
export function tableFor(skins: Partial<Record<string, string>> | undefined): Skin {
  const table = skinById(skins?.table);
  if (table?.kind === "table") return table;
  const cards = pickedSkin(skins, "cards");
  return SKINS.find((s) => s.kind === "table" && s.felt && s.felt === cards.felt) ?? defaultSkin("table");
}

export function useTable(): Skin {
  const { me } = useApp();
  return tableFor(me.skins);
}

// Goti picture for a colour, from the picked pack (falls back to emoji).
export function tokenLook(skin: Skin, color: TokenColor): { art?: string; emoji?: string } {
  const art = skinArt(skin.pack === "pawn" ? `pawn-${color}.webp` : `tok-${skin.pack}-${color}.webp`);
  return { art, emoji: art ? undefined : skin.emoji?.[color] };
}
