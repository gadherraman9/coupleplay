import { useState } from "react";
import { ArrowLeft, Check, Heart } from "lucide-react";
import { api } from "../backend/store";
import { attempt, useApp } from "../context";
import { APP_THEMES, CHAT_THEMES, chatThemeStyle } from "../themes";

export default function ShopScreen({ onBack }: { onBack: () => void }) {
  const { me, notify } = useApp();
  const [tab, setTab] = useState<"app" | "chat">("app");
  const items = tab === "app" ? APP_THEMES : CHAT_THEMES;
  const active = tab === "app" ? me.appTheme : me.chatTheme;

  const choose = (id: string, price: number, name: string) => {
    const owned = me.ownedThemes.includes(id);
    attempt(notify, () => {
      if (!owned) {
        api.buyTheme(me.id, id, price);
        notify(`Unlocked ${name}!`);
      }
      api.applyTheme(me.id, tab, id);
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
            <strong>Theme shop</strong>
            <span>Spend hearts on new looks</span>
          </div>
        </div>
        <span className="hearts-pill">
          <Heart size={14} fill="currentColor" /> {me.hearts}
        </span>
      </header>

      <div className="shop-body">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "app"} className={tab === "app" ? "is-active" : ""} onClick={() => setTab("app")}>
            App themes
          </button>
          <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "is-active" : ""} onClick={() => setTab("chat")}>
            Chat themes
          </button>
        </div>

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
        <p className="games-note">Earn hearts by winning games (+20), daily tasks (+10) and signing up (+50).</p>
      </div>
    </div>
  );
}
