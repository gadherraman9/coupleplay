import { useState } from "react";
import { ArrowLeft, Check, Heart } from "lucide-react";
import { api } from "../backend/store";
import { attempt, useApp } from "../context";
import { APP_THEMES, CHAT_THEMES, chatThemeStyle } from "../themes";
import { defaultSkin, SKINS, tableFor } from "../skins";
import type { Skin, SkinKind } from "../skins";
import SkinPreview from "../components/SkinPreview";

const SKIN_GROUPS: { kind: SkinKind; title: string; short: string }[] = [
  { kind: "dice", title: "Dice", short: "🎲 Dice" },
  { kind: "token", title: "Goti (Ludo & Snakes pieces)", short: "♟️ Goti" },
  { kind: "ludo", title: "Ludo boards (with music)", short: "🏠 Ludo" },
  { kind: "snakes", title: "Snakes & Ladders boards (with music)", short: "🐍 Snakes" },
  { kind: "cards", title: "Card backs", short: "🂠 Cards" },
  { kind: "table", title: "Table colours", short: "🟩 Tables" },
];

export default function ShopScreen({ onBack }: { onBack: () => void }) {
  const { me, notify } = useApp();
  const [tab, setTab] = useState<"app" | "chat" | "skins">("skins");
  const [kind, setKind] = useState<SkinKind>("dice");
  const items = tab === "app" ? APP_THEMES : CHAT_THEMES;
  const active = tab === "app" ? me.appTheme : me.chatTheme;

  const chooseSkin = (skin: Skin) => {
    const free = skin.price === 0;
    const owned = free || me.ownedThemes.includes(skin.id);
    attempt(notify, () => {
      if (!owned) {
        api.buyTheme(me.id, skin.id, skin.price);
        notify(`Unlocked ${skin.name}! 🎉`);
      }
      api.applySkin(me.id, skin.kind, skin.id, free);
      if (owned) notify(`${skin.name} skin applied`);
    });
  };

  const choose = (id: string, price: number, name: string) => {
    const owned = me.ownedThemes.includes(id);
    attempt(notify, () => {
      if (!owned) {
        api.buyTheme(me.id, id, price);
        notify(`Unlocked ${name}!`);
      }
      api.applyTheme(me.id, tab === "chat" ? "chat" : "app", id);
      if (owned) notify(`${name} applied`);
    });
  };

  return (
    <div className="chat-screen shop-screen">
      <header className="chat-header">
        <button type="button" className="round-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={19} />
        </button>
        <div className="chat-person">
          <div>
            <strong>Shop</strong>
            <span>Game skins and themes for your hearts</span>
          </div>
        </div>
        <span className="hearts-pill">
          <Heart size={14} fill="currentColor" /> {me.hearts}
        </span>
      </header>

      <div className="shop-body">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "skins"} className={tab === "skins" ? "is-active" : ""} onClick={() => setTab("skins")}>
            Game skins
          </button>
          <button type="button" role="tab" aria-selected={tab === "app"} className={tab === "app" ? "is-active" : ""} onClick={() => setTab("app")}>
            App themes
          </button>
          <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "is-active" : ""} onClick={() => setTab("chat")}>
            Chat themes
          </button>
        </div>

        {tab === "skins" && (
          <div className="skin-kinds" role="tablist">
            {SKIN_GROUPS.map((group) => (
              <button key={group.kind} type="button" role="tab" aria-selected={kind === group.kind} className={kind === group.kind ? "is-active" : ""} onClick={() => setKind(group.kind)}>
                {group.short}
              </button>
            ))}
          </div>
        )}
        {tab === "skins" ? (
          SKIN_GROUPS.filter((group) => group.kind === kind).map((group) => {
            const current = group.kind === "table" ? tableFor(me.skins).id : me.skins?.[group.kind] ?? defaultSkin(group.kind).id;
            return (
              <section key={group.kind} className="skin-section">
                <h3>{group.title}</h3>
                <div className="shop-grid shop-grid--skins">
                  {SKINS.filter((skin) => skin.kind === group.kind).map((skin) => {
                    const owned = skin.price === 0 || me.ownedThemes.includes(skin.id);
                    const isActive = current === skin.id;
                    return (
                      <button key={skin.id} type="button" className={`shop-item shop-item--skin ${isActive ? "is-active" : ""}`} onClick={() => chooseSkin(skin)}>
                        <SkinPreview skin={skin} />
                        <strong>{skin.name}</strong>
                        <span className="skin-blurb">{skin.blurb}</span>
                        <small>
                          {isActive ? (
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
              </section>
            );
          })
        ) : (
        <div className="shop-grid">
          {items.map((item) => {
            const owned = me.ownedThemes.includes(item.id);
            const isActive = active === item.id;
            const preview =
              "swatch" in item ? (
                <span className="shop-swatch" style={{ background: item.swatch }} />
              ) : (
                <span className="shop-chat-preview" style={{ ...chatThemeStyle(item.id) }}>
                  <i className="p-them" />
                  <i className="p-me" />
                  <i className="p-them p-short" />
                </span>
              );
            return (
              <button
                key={item.id}
                type="button"
                className={`shop-item ${isActive ? "is-active" : ""}`}
                onClick={() => choose(item.id, item.price, item.name)}
              >
                {preview}
                <strong>{item.name}</strong>
                <small>
                  {isActive ? (
                    <>
                      <Check size={12} /> In use
                    </>
                  ) : owned ? (
                    "Owned · tap to use"
                  ) : (
                    <>
                      <Heart size={11} fill="currentColor" /> {item.price}
                    </>
                  )}
                </small>
              </button>
            );
          })}
        </div>
        )}
        <p className="games-note">Earn hearts by winning games (+20), daily tasks (+10) and signing up (+50).</p>
      </div>
    </div>
  );
}
