// A standard deck shared by Poker, Call Break and Rummy, plus the card
// pictures. Card backs and table felt come from the viewer's card skin.
import type { CSSProperties } from "react";
import { isCardPhoto, skinArt, useSkin, useTable } from "../skins";
import type { Skin } from "../skins";
import { useSoundTheme } from "./music";
import { shuffle } from "./types";

export type Suit = "S" | "H" | "D" | "C";

export interface PCard {
  id: number;
  // 2..14 (14 = ace). 0 marks a printed joker (Rummy only).
  r: number;
  s: Suit | "J";
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const SUIT_GLYPH: Record<Suit | "J", string> = { S: "♠", H: "♥", D: "♦", C: "♣", J: "★" };
export const SUIT_NAME: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const RANK_LABEL: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export const rankLabel = (r: number) => (r === 0 ? "JKR" : RANK_LABEL[r] ?? String(r));
export const cardLabel = (c: PCard) => (c.r === 0 ? "Joker" : `${rankLabel(c.r)}${SUIT_GLYPH[c.s]}`);
export const isRed = (c: PCard) => c.s === "H" || c.s === "D";

export function makeDeck(decks = 1, jokers = 0): PCard[] {
  const cards: PCard[] = [];
  let id = 0;
  for (let d = 0; d < decks; d += 1) {
    for (const s of SUITS) for (let r = 2; r <= 14; r += 1) cards.push({ id: id++, r, s });
  }
  for (let j = 0; j < jokers; j += 1) cards.push({ id: id++, r: 0, s: "J" });
  return shuffle(cards);
}

// Spades, hearts, clubs, diamonds alternate colours when sorted.
const SUIT_ORDER: Record<Suit | "J", number> = { S: 0, H: 1, C: 2, D: 3, J: 4 };
export function sortHand(cards: PCard[], aceHigh = true) {
  return [...cards].sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || (aceHigh ? b.r - a.r : a.r - b.r));
}

const COURT: Record<number, string> = { 11: "♞", 12: "♛", 13: "♚" };

export function PlayingCard({
  card,
  small,
  tiny,
  selected,
  dim,
  wild,
  style,
  className = "",
}: {
  card: PCard;
  small?: boolean;
  tiny?: boolean;
  selected?: boolean;
  dim?: boolean;
  wild?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const size = tiny ? "pcard--tiny" : small ? "pcard--small" : "";
  if (card.r === 0) {
    return (
      <span className={`pcard pcard--joker ${size} ${selected ? "is-selected" : ""} ${dim ? "is-dim" : ""} ${className}`} style={style}>
        <b className="pcard-corner">JKR</b>
        <span className="pcard-pip">🃏</span>
      </span>
    );
  }
  const glyph = SUIT_GLYPH[card.s];
  return (
    <span
      className={`pcard ${isRed(card) ? "is-red" : ""} ${size} ${selected ? "is-selected" : ""} ${dim ? "is-dim" : ""} ${wild ? "is-wild" : ""} ${className}`}
      style={style}
      aria-label={cardLabel(card)}
    >
      <b className="pcard-corner">
        {rankLabel(card.r)}
        <i>{glyph}</i>
      </b>
      <span className="pcard-pip">{card.r >= 11 && card.r <= 13 ? <><small>{COURT[card.r]}</small>{glyph}</> : glyph}</span>
      <b className="pcard-corner pcard-corner--end">
        {rankLabel(card.r)}
        <i>{glyph}</i>
      </b>
      {wild && <em className="pcard-wild">WILD</em>}
    </span>
  );
}

// Local photos take precedence over catalog art; never accept arbitrary URLs.
export function backStyle(skin: Skin): CSSProperties | undefined {
  if (isCardPhoto(skin.customBack)) return { backgroundImage: `url("${skin.customBack}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" };
  const art = skinArt(skin.back);
  if (art) return { backgroundImage: `url(${art})`, backgroundSize: "cover" };
  if (skin.backCss) return { background: skin.backCss };
  return undefined;
}

export function CardBack({ small, tiny, style, className = "" }: { small?: boolean; tiny?: boolean; style?: CSSProperties; className?: string }) {
  const skin = useSkin("cards");
  return (
    <span
      className={`pcard pcard--back ${tiny ? "pcard--tiny" : small ? "pcard--small" : ""} ${className}`}
      style={{ ...backStyle(skin), ...style }}
      aria-hidden="true"
    />
  );
}

// Table background for the card games, from the viewer's table colour.
export function feltStyle(skin: Skin): CSSProperties {
  const art = skinArt(skin.felt);
  if (art) return { backgroundImage: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,.45) 100%), url(${art})`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: skin.tint };
  if (skin.bg) return { background: skin.bg };
  return { background: `radial-gradient(ellipse at 50% 40%, ${skin.tint ?? "#2f9e5b"} 0%, #0d2a1a 100%)` };
}

export function useFelt(): CSSProperties {
  return feltStyle(useTable());
}

// Card game views call this so the table's music and sounds play.
export function useTableSound() {
  useSoundTheme(useTable().sound);
}

// Where each opponent sits around a table, seen from my seat at the bottom.
export function seatOrder<T>(players: T[], me: T) {
  const mine = Math.max(0, players.indexOf(me));
  return players.map((_, i) => players[(mine + i) % players.length]);
}
