import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, MessageCircle, RefreshCw, Trophy, X } from "lucide-react";
import { api, areFriends } from "../backend/store";
import { attempt, useApp } from "../context";
import { botName, gameById } from "../games/registry";
import { isBotPlayer } from "../games/types";
import ConversationView from "./ConversationView";
import SafetySheet from "./SafetySheet";

const WIN_REWARD = 20;

export default function GameHost({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { db, me, notify, nameOf, playGame } = useApp();
  const session = db.games.find((g) => g.id === sessionId);
  const def = session ? gameById(session.game) : undefined;
  const [chatOpen, setChatOpen] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const seenMessages = useRef<number | null>(null);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of session?.players ?? []) {
      map[player] = player === me.id ? "You" : isBotPlayer(player) ? botName(player) : nameOf(player);
    }
    return map;
  }, [session?.players, me.id, nameOf]);

  const act = useCallback(
    (action: unknown) => {
      if (!def) return;
      attempt(notify, () =>
        api.updateGame(sessionId, (s) => {
          s.state = def.apply(s.state, action, me.id);
          s.winner = def.winner(s.state);
          if (s.winner) s.status = "finished";
        }),
      );
      const typed = action as { type?: string; score?: number };
      if (def.id === "bounce" && typed.type === "over" && typed.score) {
        const reward = Math.min(15, Math.floor(typed.score / 150));
        if (reward > 0) {
          api.addHearts(me.id, reward);
          notify(`+${reward} hearts for your bounce!`);
        }
      }
    },
    [def, sessionId, me.id, notify],
  );

  // The host's tab plays for the bots.
  const current = session && def?.currentPlayer ? def.currentPlayer(session.state) : null;
  useEffect(() => {
    if (!session || !def?.botMove || session.status !== "playing" || session.host !== me.id) return;
    if (!current || !(isBotPlayer(current) || db.users[current]?.isBot)) return;
    const rev = session.rev;
    const timer = window.setTimeout(() => {
      try {
        api.updateGame(sessionId, (s) => {
          if (s.rev !== rev) return;
          const move = def.botMove!(s.state, current);
          if (!move) return;
          s.state = def.apply(s.state, move, current);
          s.winner = def.winner(s.state);
          if (s.winner) s.status = "finished";
        });
      } catch {
        /* game was closed */
      }
    }, def.botDelay ?? 900);
    return () => window.clearTimeout(timer);
  }, [session, def, current, me.id, sessionId, db.users]);

  const rewardKey = `cp_reward_${sessionId}_${me.id}`;
  useEffect(() => {
    if (session?.winner !== me.id) return;
    try {
      if (localStorage.getItem(rewardKey)) return;
      localStorage.setItem(rewardKey, "1");
    } catch {
      /* storage blocked: reward anyway */
    }
    api.addHearts(me.id, WIN_REWARD);
    notify(`You won! +${WIN_REWARD} hearts`);
  }, [session?.winner, me.id, rewardKey, notify]);

  const chatCount = db.messages.filter((m) => m.convId === session?.convId).length;
  useEffect(() => {
    if (chatOpen) seenMessages.current = chatCount;
    else if (seenMessages.current === null) seenMessages.current = chatCount;
  }, [chatOpen, chatCount]);
  const unread = !chatOpen && seenMessages.current !== null ? chatCount - seenMessages.current : 0;

  if (!session || !def) {
    return (
      <div className="game-overlay">
        <header className="game-topbar">
          <button type="button" className="round-btn" onClick={onClose} aria-label="Close game">
            <X size={19} />
          </button>
          <div className="game-topbar-title">
            <h2>Game not found</h2>
          </div>
        </header>
      </div>
    );
  }

  const humans = session.players.filter((p) => !isBotPlayer(p) && !db.users[p]?.isBot);
  const opponents = session.players.filter((p) => p !== me.id);
  const strangers = opponents.filter((p) => !isBotPlayer(p) && !areFriends(db, me.id, p));
  const View = def.View;
  const finished = session.status === "finished";
  const hasChat = humans.length > 1 || session.convId.startsWith("dm:");

  return (
    <div className="game-overlay" role="dialog" aria-modal="true" aria-label={def.title}>
      <header className="game-topbar">
        <button type="button" className="round-btn" onClick={onClose} aria-label="Close game">
          <X size={19} />
        </button>
        <div className="game-topbar-title">
          <h2>
            {def.emoji} {def.title}
          </h2>
          <p>
            {def.soloOnly
              ? "Solo play"
              : `with ${opponents.map((p) => names[p]).join(", ")}`}
          </p>
        </div>
        {strangers.length > 0 && (
          <button type="button" className="round-btn" onClick={() => setReporting(strangers[0])} aria-label="Report player">
            <Flag size={16} />
          </button>
        )}
        {hasChat && (
          <button type="button" className="round-btn chat-toggle" onClick={() => setChatOpen((v) => !v)} aria-label="Chat while playing">
            <MessageCircle size={18} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
        )}
      </header>

      <div className="game-body game-body--board">
        <View state={session.state} me={me.id} players={session.players} names={names} act={act} finished={finished} />

        {finished && !def.soloOnly && (
          <div className="win-banner">
            <Trophy size={22} />
            <strong>{session.winner === me.id ? "You won! 🎉" : `${names[session.winner ?? ""] ?? "Someone"} won`}</strong>
            <button type="button" className="primary-btn" onClick={() => playGame(def.id, opponents, session.convId.startsWith("dm:") ? session.convId : undefined)}>
              <RefreshCw size={16} /> Rematch
            </button>
          </div>
        )}
      </div>

      {chatOpen && hasChat && (
        <div className="game-chat">
          <div className="game-chat-head">
            <strong>Chat</strong>
            <button type="button" className="round-btn round-btn--small" onClick={() => setChatOpen(false)} aria-label="Hide chat">
              <X size={15} />
            </button>
          </div>
          <ConversationView convId={session.convId} group={humans.length > 2} compact emptyTitle="Talk while you play" />
        </div>
      )}

      {reporting && <SafetySheet targetId={reporting} mode="report" onClose={() => setReporting(null)} />}
    </div>
  );
}
