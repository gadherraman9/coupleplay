import { skinArt, tokenLook } from "../skins";
import type { Skin, TokenColor } from "../skins";
import { DieFace } from "../games/ui";
import { backStyle, feltStyle } from "../games/deck";

const COLORS: [TokenColor, string][] = [["red", "#ef4444"], ["green", "#22c55e"], ["yellow", "#eab308"], ["blue", "#3b82f6"]];

// Small picture of a skin for shop cards: a die, four goti, a card back,
// a table swatch or the board.
export default function SkinPreview({ skin }: { skin: Skin }) {
  if (skin.kind === "dice") {
    return (
      <span className="skin-preview skin-preview--dice">
        <DieFace face={5} look={skin.dice} />
      </span>
    );
  }
  if (skin.kind === "token") {
    return (
      <span className="skin-preview skin-preview--token">
        {COLORS.map(([color, hex]) => {
          const look = tokenLook(skin, color);
          return look.art ? <img key={color} src={look.art} alt="" /> : <i key={color} style={{ background: hex }}>{look.emoji}</i>;
        })}
      </span>
    );
  }
  if (skin.kind === "cards") {
    return (
      <span className="skin-preview skin-preview--cards" style={{ background: "linear-gradient(135deg,#f5f3ff,#fce7f3)" }}>
        <span className="skin-preview-card" style={backStyle(skin)} />
      </span>
    );
  }
  if (skin.kind === "table") return <span className="skin-preview skin-preview--table" style={feltStyle(skin)} />;
  const main = skinArt(skin.preview) ?? skinArt(skin.board);
  return (
    <span className={`skin-preview skin-preview--${skin.kind}`} style={main ? { backgroundColor: skin.tint, backgroundImage: `url(${main})` } : { background: skin.bg ?? skin.tint ?? "linear-gradient(135deg,#fde68a,#f9a8d4)" }}>
      {!main && <b>{skin.kind === "ludo" ? "🎲" : "🐍"}</b>}
    </span>
  );
}
