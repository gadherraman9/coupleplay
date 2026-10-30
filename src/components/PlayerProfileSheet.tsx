import { useState } from "react";
import { Ban, Check, Clock, Flag, Flame, Heart, MessageCircle, Trophy, UserPlus } from "lucide-react";
import { api, areFriends, hasBlocked, isOnline } from "../backend/store";
import { attempt, useApp } from "../context";
import { botName } from "../games/registry";
import { isBotPlayer } from "../games/types";
import { UserAvatar } from "./Avatar";
import SafetySheet from "./SafetySheet";
import Sheet from "./Sheet";

interface PlayerProfileSheetProps {
  playerId: string;
  onClose: () => void;
  onChat?: () => void;
}

// Plato-style player card: who they are, how you've done together, and the
// social actions (add friend, chat, report, block) without leaving the game.
export default function PlayerProfileSheet({ playerId, onClose, onChat }: PlayerProfileSheetProps) {
  const { db, me, notify, nameOf } = useApp();
  const [safety, setSafety] = useState<"block" | "report" | null>(null);

  if (isBotPlayer(playerId)) {
    return (
      <Sheet title={botName(playerId)} onClose={onClose}>
        <div className="player-card">
          <UserAvatar id={playerId} size={76} />
          <h3>{botName(playerId)}</h3>
          <p className="player-card-sub">Practice bot · plays automatically</p>
        </div>
      </Sheet>
    );
  }

  const user = db.users[playerId];
  const isMe = playerId === me.id;
  const friends = areFriends(db, me.id, playerId);
  const requested = db.requests.some((r) => r.from === me.id && r.to === playerId);
  const incoming = db.requests.find((r) => r.from === playerId && r.to === me.id);
  const blocked = hasBlocked(db, me.id, playerId);
  const together = db.games.filter((g) => g.status === "finished" && g.players.includes(playerId) && g.players.includes(me.id));
  const wins = together.filter((g) => g.winner === playerId).length;
  const myWins = together.filter((g) => g.winner === me.id).length;
  const since = user ? new Date(user.createdAt || Date.now()).toLocaleDateString([], { month: "short", year: "numeric" }) : "";

  const addFriend = () =>
    attempt(notify, () => {
      if (incoming) {
        api.acceptRequest(incoming.id);
        notify(`You and ${nameOf(playerId)} are now friends`);
        return;
      }
      const { accepted } = api.sendFriendRequest(me.id, user!.username);
      notify(accepted ? `You and ${nameOf(playerId)} are now friends` : `Friend request sent to ${nameOf(playerId)}`);
    });

  return (
    <Sheet title={isMe ? "Your profile" : "Player"} onClose={onClose}>
      <div className="player-card">
        <UserAvatar id={playerId} size={76} />
        <h3>
          {nameOf(playerId)} {user?.isBot && <span className="bot-tag">demo bot</span>}
        </h3>
        <p className="player-card-sub">
          {user ? `@${user.username}` : "Unknown player"}
          {user && !isMe && (isOnline(db, playerId) ? " · online" : " · offline")}
          {friends && " · friend"}
        </p>

        {user && (
          <div className="player-stats">
            <span>
              <Heart size={14} fill="currentColor" /> <b>{user.hearts}</b> hearts
            </span>
            <span>
              <Flame size={14} /> <b>{user.streak}</b> day streak
            </span>
            {!isMe && (
              <span>
                <Trophy size={14} /> <b>{myWins}–{wins}</b> you vs them
              </span>
            )}
            <span>
              <Clock size={14} /> since <b>{since}</b>
            </span>
          </div>
        )}

        {!isMe && user && (
          <div className="player-actions">
            {friends ? (
              <button type="button" className="ghost-btn" disabled>
                <Check size={16} /> Friends
              </button>
            ) : (
              <button type="button" className="primary-btn" disabled={requested || blocked} onClick={addFriend}>
                <UserPlus size={16} /> {incoming ? "Accept request" : requested ? "Request sent" : "Add friend"}
              </button>
            )}
            {onChat && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  onClose();
                  onChat();
                }}
              >
                <MessageCircle size={16} /> Chat in game
              </button>
            )}
            <div className="player-actions-row">
              <button type="button" className="text-btn is-danger" onClick={() => setSafety("report")}>
                <Flag size={15} /> Report
              </button>
              {!blocked && (
                <button type="button" className="text-btn is-danger" onClick={() => setSafety("block")}>
                  <Ban size={15} /> Block
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {safety && <SafetySheet targetId={playerId} mode={safety} onClose={() => setSafety(null)} onDone={onClose} />}
    </Sheet>
  );
}
