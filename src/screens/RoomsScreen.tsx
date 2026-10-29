import { useState } from "react";
import { ArrowLeft, ChevronRight, Users } from "lucide-react";
import ConversationView from "../components/ConversationView";
import PersonActions from "../components/PersonActions";
import Sheet from "../components/Sheet";
import { api } from "../backend/store";
import { useApp } from "../context";
import { unreadCount } from "./ChatsScreen";

export default function RoomsScreen({ onBack }: { onBack: () => void }) {
  const { db, me } = useApp();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [people, setPeople] = useState(false);
  const room = db.rooms.find((r) => r.id === roomId);

  if (room) {
    const convId = `room:${room.id}`;
    const recent = [...new Set(db.messages.filter((m) => m.convId === convId).map((m) => m.from))].filter((id) => id !== me.id);
    return (
      <div className="chat-screen">
        <header className="chat-header">
          <button
            type="button"
            className="round-btn"
            onClick={() => {
              api.sendMessage(me.id, convId, { kind: "system", text: `${me.displayName} left` });
              setRoomId(null);
            }}
            aria-label="Leave room"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="chat-person">
            <span className="room-emoji">{room.emoji}</span>
            <div>
              <strong>{room.name}</strong>
              <span>{room.topic}</span>
            </div>
          </div>
          <button type="button" className="round-btn" onClick={() => setPeople(true)} aria-label="People in this room">
            <Users size={18} />
          </button>
        </header>
        <ConversationView convId={convId} group emptyTitle={`Welcome to ${room.name}`} />
        {people && (
          <Sheet title="People in this room" onClose={() => setPeople(false)}>
            {recent.length === 0 && <p className="sheet-note">No one has talked yet. Say hi!</p>}
            <div className="list-card">
              {recent.map((id) => (
                <PersonActions key={id} id={id} />
              ))}
            </div>
          </Sheet>
        )}
      </div>
    );
  }

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button type="button" className="round-btn" onClick={onBack} aria-label="Back">
          <ArrowLeft size={19} />
        </button>
        <div className="chat-person">
          <div>
            <strong>Chat rooms</strong>
            <span>Public group chats · be kind</span>
          </div>
        </div>
      </header>
      <div className="shop-body">
        <div className="card list-card">
          {db.rooms.map((r) => {
            const convId = `room:${r.id}`;
            const count = db.messages.filter((m) => m.convId === convId).length;
            const unread = unreadCount(db.messages, db.reads, me.id, convId);
            return (
              <button
                key={r.id}
                type="button"
                className="chat-row"
                onClick={() => {
                  setRoomId(r.id);
                  try {
                    api.sendMessage(me.id, convId, { kind: "system", text: `${me.displayName} joined` });
                  } catch {
                    /* suspended users can still read */
                  }
                }}
              >
                <span className="room-emoji room-emoji--big">{r.emoji}</span>
                <span className="chat-row-body">
                  <span className="chat-row-top">
                    <strong>{r.name}</strong>
                    <time>{count} msgs</time>
                  </span>
                  <span className="chat-row-snippet">
                    {r.topic}
                    {unread > 0 && <span className="badge badge--inline">{unread}</span>}
                  </span>
                </span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
        <p className="games-note">Report anyone who breaks the rules. 10 reports suspend an account.</p>
      </div>
    </div>
  );
}
