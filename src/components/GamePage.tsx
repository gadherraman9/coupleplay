import { useState } from "react";
import { ArrowLeft, Check, Heart, Star, Trophy } from "lucide-react";
import { api, friendIds } from "../backend/store";
import { attempt, useApp } from "../context";
import { gameById } from "../games/registry";
import { GENERIC_RULES, RULES } from "../games/rules";
import { levelProgress } from "../progress";
import { defaultSkin, SKINS, skinArt } from "../skins";
import type { Skin, SkinKind } from "../skins";
import { UserAvatar } from "./Avatar";
import GameModeSheet from "./GameModeSheet";

// Which skin set a game uses (for its Shop tab and the in-game Items button).
export function skinKindOf(gameId: string, felt?: boolean): SkinKind | null {
  if (gameId === "ludo") return "ludo";
  if (gameId === "snakes") return "snakes";
  return felt ? "cards" : null;
}

type Tab = "play" | "shop" | "leaders" | "rules";

export function SkinPicker({ kind, ownedOnly = false }: { kind: SkinKind; ownedOnly?: boolean }) {
  const { me, notify } = useApp();
  const current = me.skins?.[kind] ?? defaultSkin(kind).id;
  const list = SKINS.filter((s) => s.kind === kind && (!ownedOnly || s.price === 0 || me.ownedThemes.includes(s.id)));
  const choose = (skin: Skin) => {
    const free = skin.price === 0;
    const owned = free || me.ownedThemes.includes(skin.id);
    attempt(notify, () => {
      if (!owned) {
        api.buyTheme(me.id, skin.id, skin.price);
        notify(`Unlocked ${skin.name}! 🎉`);
      }
      api.applySkin(me.id, kind, skin.id, free);
      if (owned) notify(`${skin.name} applied`);
    });
  };
  return (
    <div className="shop-grid shop-grid--skins">
      {list.map((skin) => {
        const owned = skin.price === 0 || me.ownedThemes.includes(skin.id);
        const art = skinArt(skin.preview) ?? skinArt(skin.board) ?? skinArt(skin.felt);
        const back = skinArt(skin.back);
        return (
          <button key={skin.id} type="button" className={`shop-item shop-item--skin ${current === skin.id ? "is-active" : ""}`} onClick={() => choose(skin)}>
            <span className="skin-preview" style={{ background: skin.tint ?? "linear-gradient(135deg,#fde68a,#f9a8d4)", ...(art ? { backgroundImage: `url(${art})` } : null) }}>
              {back && <img src={back} alt="" />}
            </span>
            <strong>{skin.name}</strong>
            <small>
              {current === skin.id ? (
                <>
                  <Check size={12} /> In use
                </>
              ) : owned ? (
                "Owned · tap to use"
              ) : (
                <>
                  <Heart size={11} fill="currentColor" /> {skin.price}
                </>
              )}
            </small>
          </button>
        );
      })}
    </div>
  );
}

// Each game's own page: banner with your level and record, then tabs to
// play, shop its skins, see the friends leaderboard and read the rules.
export default function GamePage({ gameId, onClose, onFindStrangers }: { gameId: string; onClose: () => void; onFindStrangers: (gameId: string) => void }) {
  const { db, me, nameOf } = useApp();
  const def = gameById(gameId);
  const [tab, setTab] = useState<Tab>("play");
  if (!def) return null;
  const kind = skinKindOf(def.id, def.felt);
  const level = levelProgress(me.xp);
  const stats = me.gameStats?.[def.id] ?? { played: 0, won: 0 };
  const board = [me.id, ...friendIds(db, me.id).filter((id) => !db.users[id]?.isBot)]
    .map((id) => ({ id, ...(db.users[id]?.gameStats?.[def.id] ?? { played: 0, won: 0 }) }))
    .sort((a, b) => b.won - a.won || b.played - a.played);
  const rules = RULES[def.id] ?? GENERIC_RULES;
  const tabs: [Tab, string][] = [["play", "Play"], ...(kind ? ([["shop", "Shop"]] as [Tab, string][]) : []), ["leaders", "Leaderboard"], ["rules", "How to play"]];

  return (
    <div className="game-overlay game-page" role="dialog" aria-modal="true" aria-label={def.title}>
      <div className={`game-card ${def.className} game-page-banner`}>
        <button type="button" className="round-btn game-page-back" onClick={onClose} aria-label="Back">
          <ArrowLeft size={19} />
        </button>
        <div className="game-page-head">
          <span className="game-page-star">
            <Star size={44} fill="currentColor" />
            <b>{level.level}</b>
          </span>
          <div className="game-page-meta">
            <h2>
              {def.emoji} {def.title}
            </h2>
            <span className="game-page-xp">
              <i style={{ width: `${level.pct}%` }} />
            </span>
            <small>
              Played: {stats.played} · Won: {stats.won}
            </small>
          </div>
        </div>
      </div>

      <div className="game-page-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="game-page-body">
        {tab === "play" && <GameModeSheet gameId={def.id} onClose={onClose} onFindStrangers={onFindStrangers} embedded />}
        {tab === "shop" && kind && (
          <>
            <p className="games-note">Skins change how this game looks for you. You have {me.hearts} ❤.</p>
            <SkinPicker kind={kind} />
          </>
        )}
        {tab === "leaders" && (
          <div className="leaderboard">
            <p className="games-note">You and your friends, by {def.title} wins.</p>
            {board.map((row, i) => (
              <div key={row.id} className={`leader-row ${row.id === me.id ? "is-me" : ""} ${i < 3 && row.won > 0 ? `is-top is-top-${i + 1}` : ""}`}>
                <span className="leader-rank">{i < 3 && row.won > 0 ? <Trophy size={18} /> : i + 1}</span>
                <UserAvatar id={row.id} size={40} />
                <span className="leader-name">{row.id === me.id ? "You" : nameOf(row.id)}</span>
                <span className="leader-score">
                  {row.won} <small>/ {row.played}</small>
                </span>
              </div>
            ))}
            {board.length === 1 && <p className="games-note">Add friends to compete on the leaderboard.</p>}
          </div>
        )}
        {tab === "rules" && (
          <div className="rules">
            {rules.map((r) => (
              <section key={r.title}>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
