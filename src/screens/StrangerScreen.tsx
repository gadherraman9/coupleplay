import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Shuffle, SkipForward } from "lucide-react";
import ConversationView from "../components/ConversationView";
import PersonActions from "../components/PersonActions";
import { api } from "../backend/store";
import { attempt, useApp } from "../context";

const BOT_FALLBACK_AFTER = 8;

export default function StrangerScreen({ onBack }: { onBack: () => void }) {
  const { db, me, notify } = useApp();
  const [searching, setSearching] = useState(false);
  const [waited, setWaited] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const since = useRef(0);
  const chat = db.strangers.find((c) => c.id === chatId);
  const other = chat ? (chat.a === me.id ? chat.b : chat.a) : null;

  // Someone else may have matched with us while we waited.
  useEffect(() => {
    if (!searching) return;
    const found = db.strangers.find((c) => c.open && c.createdAt >= since.current && (c.a === me.id || c.b === me.id));
    if (found) {
      setChatId(found.id);
      setSearching(false);
    }
  }, [db.strangers, searching, me.id]);

  useEffect(() => {
    if (!searching) return;
    const tick = () => {
      setWaited((value) => value + 1);
      try {
        const match = api.findStranger(me.id);
        if (match) {
          setChatId(match.id);
          setSearching(false);
        }
      } catch {
        /* storage hiccup: try again next tick */
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [searching, me.id]);

  useEffect(() => () => api.leaveQueue(me.id), [me.id]);

  const search = () => {
    if (me.suspended) return;
    if (chat?.open) api.endStranger(chat.id);
    setChatId(null);
    setWaited(0);
    since.current = Date.now();
    setSearching(true);
  };

  const talkToBot = () => {
    const bots = Object.values(db.users).filter((u) => u.isBot);
    const bot = bots[Math.floor(Math.random() * bots.length)];
    attempt(notify, () => {
      const created = api.startBotStranger(me.id, bot.id);
      setChatId(created.id);
      setSearching(false);
    });
  };

  const leave = () => {
    if (chat?.open) {
      api.sendMessage(me.id, `str:${chat.id}`, { kind: "system", text: `${me.displayName} left the chat` });
      api.endStranger(chat.id);
    }
    api.leaveQueue(me.id);
    onBack();
  };

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button type="button" className="round-btn" onClick={leave} aria-label="Leave">
          <ArrowLeft size={19} />
        </button>
        <div className="chat-person">
          <div>
            <strong>Talk to a stranger</strong>
            <span>{chat ? (chat.open ? "Connected · be kind" : "Chat ended") : searching ? "Looking for someone…" : "Random 1-on-1 chat"}</span>
          </div>
        </div>
        {chat && (
          <button type="button" className="round-btn" onClick={search} aria-label="Next stranger">
            <SkipForward size={18} />
          </button>
        )}
      </header>

      {chat && other ? (
        <>
          <div className="stranger-bar">
            <PersonActions id={other} onBlocked={search} />
          </div>
          <ConversationView
            convId={`str:${chat.id}`}
            emptyTitle="You're connected! Say hi 👋"
            blockedReason={chat.open ? undefined : "This chat has ended. Tap ⏭ to meet someone new."}
          />
        </>
      ) : (
        <div className="stranger-lobby">
          <div className={`radar ${searching ? "is-searching" : ""}`}>
            <Shuffle size={34} />
          </div>
          {searching ? (
            <>
              <h2>Finding someone…</h2>
              <p>Open CouplePlay in another tab or on a friend's device to match with a real person.</p>
              {waited >= BOT_FALLBACK_AFTER && (
                <button type="button" className="ghost-btn" onClick={talkToBot}>
                  No one yet — chat with a demo bot
                </button>
              )}
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setSearching(false);
                  api.leaveQueue(me.id);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <h2>Meet someone new</h2>
              <p>You'll be paired with a random person who is also looking. You can add them as a friend, or report and block them.</p>
              <button type="button" className="primary-btn" onClick={search} disabled={me.suspended}>
                Start
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
