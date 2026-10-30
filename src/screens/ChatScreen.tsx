import { useState } from "react";
import { ArrowLeft, Ban, Flag, Gamepad2, Heart, HeartOff, MoreVertical, UserMinus } from "lucide-react";
import { UserAvatar } from "../components/Avatar";
import ConversationView from "../components/ConversationView";
import SafetySheet from "../components/SafetySheet";
import Sheet from "../components/Sheet";
import { api, areFriends, hasBlocked, isOnline, lastSeenText, otherInDm } from "../backend/store";
import { useApp } from "../context";
import { ONLINE_GAMES } from "../games/registry";

const QUICK_REPLIES = ["Miss you 💕", "Let's play a game?", "You're my favorite"];

export default function ChatScreen({ convId, onBack }: { convId: string; onBack: () => void }) {
  const { db, me, notify, nameOf, playGame } = useApp();
  const other = otherInDm(convId, me.id);
  const user = db.users[other];
  const [menu, setMenu] = useState(false);
  const [games, setGames] = useState(false);
  const [safety, setSafety] = useState<"block" | "report" | null>(null);
  const friends = areFriends(db, me.id, other);
  const iBlocked = hasBlocked(db, me.id, other);
  const theyBlocked = hasBlocked(db, other, me.id);
  const isPartner = me.partnerId === other;

  const blockedReason = iBlocked
    ? "You blocked this person. Unblock them from the Friends tab."
    : theyBlocked
      ? "You can't reply to this conversation."
      : !friends
        ? "You're not friends anymore. Send a friend request to chat again."
        : undefined;

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button type="button" className="round-btn" onClick={onBack} aria-label="Back to chats">
          <ArrowLeft size={19} />
        </button>
        <div className="chat-person">
          <UserAvatar id={other} size={40} />
          <div>
            <strong>
              {nameOf(other)} {user?.isBot && <span className="bot-tag">demo bot</span>}
            </strong>
            <span className={isOnline(db, other) ? "is-online" : ""}>
              {isOnline(db, other) ? "Online now" : user?.isBot ? `@${user.username}` : lastSeenText(db, other)}
            </span>
          </div>
        </div>
        {friends && !blockedReason && (
          <button type="button" className="round-btn" onClick={() => setGames(true)} aria-label="Play a game together">
            <Gamepad2 size={18} />
          </button>
        )}
        <button type="button" className="round-btn" onClick={() => setMenu(true)} aria-label="More options">
          <MoreVertical size={18} />
        </button>
      </header>

      <ConversationView convId={convId} blockedReason={blockedReason} emptyTitle={`Say hi to ${nameOf(other)}`} quickReplies={QUICK_REPLIES} />

      {menu && (
        <Sheet title={nameOf(other)} onClose={() => setMenu(false)}>
          <div className="menu-list">
            {friends && (
              <button
                type="button"
                onClick={() => {
                  api.setPartner(me.id, isPartner ? undefined : other);
                  notify(isPartner ? "Partner removed" : `${nameOf(other)} is now your partner 💞`);
                  setMenu(false);
                }}
              >
                {isPartner ? <HeartOff size={18} /> : <Heart size={18} />}
                {isPartner ? "Remove as partner" : "Set as my partner"}
              </button>
            )}
            {friends && (
              <button
                type="button"
                onClick={() => {
                  api.unfriend(me.id, other);
                  notify(`Removed ${nameOf(other)} from friends`);
                  setMenu(false);
                }}
              >
                <UserMinus size={18} /> Unfriend
              </button>
            )}
            {!iBlocked && (
              <button type="button" className="is-danger" onClick={() => { setMenu(false); setSafety("block"); }}>
                <Ban size={18} /> Block
              </button>
            )}
            <button type="button" className="is-danger" onClick={() => { setMenu(false); setSafety("report"); }}>
              <Flag size={18} /> Report
            </button>
          </div>
        </Sheet>
      )}

      {games && (
        <Sheet title={`Play with ${nameOf(other)}`} onClose={() => setGames(false)}>
          <div className="mini-games mini-games--sheet">
            {ONLINE_GAMES.filter((g) => !g.soloOnly).map((game) => (
              <button
                key={game.id}
                type="button"
                className={`mini-game ${game.className}`}
                onClick={() => {
                  playGame(game.id, [other], convId);
                  setGames(false);
                }}
              >
                <span>{game.emoji}</span>
                <small>{game.title}</small>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {safety && <SafetySheet targetId={other} mode={safety} onClose={() => setSafety(null)} onDone={safety === "block" ? onBack : undefined} />}
    </div>
  );
}
