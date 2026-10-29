import { Compass, Dices, Heart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GameId } from "./data";

export const GAME_ICONS: Record<GameId, LucideIcon> = {
  truth: Heart,
  dice: Dices,
  quiz: Sparkles,
  wheel: Compass,
};
