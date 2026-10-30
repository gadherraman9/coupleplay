// Game skins: board looks for Ludo and Snakes & Ladders, card backs and table
// felts for the card games. Artwork lives in src/assets/skins (made with
// Gemini); a skin whose picture is missing simply falls back to its colours.
import { useApp } from "./context";

export type SkinKind = "ludo" | "snakes" | "cards";

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
  // Snakes: square colours drawn over the board picture.
  cells?: string[];
  // Fallback colour for the table when there's no picture.
  tint?: string;
}

const files = import.meta.glob("./assets/skins/*.{webp,png,jpg}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export function skinArt(name?: string) {
  if (!name) return undefined;
  return files[`./assets/skins/${name}`];
}

export const SKINS: Skin[] = [
  { id: "ludo-classic", kind: "ludo", name: "Classic", price: 0, blurb: "The board you know" },
  { id: "ludo-battle", kind: "ludo", name: "Battle", price: 200, blurb: "Four armies. Captures are shoot-outs!", pieces: "soldier", board: "ludo-battle.webp", preview: "ludo-battle-preview.webp", tint: "#4d5b2c" },
  { id: "ludo-royal", kind: "ludo", name: "Royal Palace", price: 120, blurb: "Marble and gold", board: "ludo-royal.webp", tint: "#d8c9a3" },
  { id: "ludo-space", kind: "ludo", name: "Galaxy", price: 120, blurb: "Race across the stars", board: "ludo-space.webp", tint: "#1b1640" },

  { id: "snakes-classic", kind: "snakes", name: "Classic", price: 0, blurb: "Bright and simple" },
  { id: "snakes-jungle", kind: "snakes", name: "Jungle", price: 90, blurb: "Vines, leaves and wild snakes", board: "snakes-jungle.webp", tint: "#2f6b2a", cells: ["rgba(254,243,199,.55)", "rgba(187,247,208,.55)"] },
  { id: "snakes-space", kind: "snakes", name: "Outer Space", price: 120, blurb: "Climb to the moon", board: "snakes-space.webp", tint: "#1e1b4b", cells: ["rgba(30,27,75,.45)", "rgba(91,33,182,.4)"] },
  { id: "snakes-candy", kind: "snakes", name: "Candy Land", price: 90, blurb: "Sweet and sugary", board: "snakes-candy.webp", tint: "#f9a8d4", cells: ["rgba(255,255,255,.55)", "rgba(251,207,232,.55)"] },

  { id: "cards-classic", kind: "cards", name: "Classic Green", price: 0, blurb: "Casino green table", back: "back-classic.webp", felt: "felt-green.webp", tint: "#17663a" },
  { id: "cards-royal", kind: "cards", name: "Royal Red", price: 100, blurb: "Red velvet and gold", back: "back-royal.webp", felt: "felt-red.webp", tint: "#7f1d1d" },
  { id: "cards-midnight", kind: "cards", name: "Midnight", price: 100, blurb: "Deep blue night table", back: "back-midnight.webp", felt: "felt-blue.webp", tint: "#172554" },
  { id: "cards-wood", kind: "cards", name: "Old Wood", price: 150, blurb: "Cosy wooden table, golden cards", back: "back-gold.webp", felt: "felt-wood.webp", tint: "#5b3416" },
];

export const skinById = (id?: string) => SKINS.find((s) => s.id === id);

export function defaultSkin(kind: SkinKind) {
  return SKINS.find((s) => s.kind === kind && s.price === 0)!;
}

// The skin the person looking at the screen picked (each player sees their own).
export function useSkin(kind: SkinKind): Skin {
  const { me } = useApp();
  const skin = skinById(me.skins?.[kind]);
  return skin && skin.kind === kind ? skin : defaultSkin(kind);
}
