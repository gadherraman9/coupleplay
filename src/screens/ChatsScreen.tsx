import { ChevronRight, Heart, Lock, Shuffle, UsersRound } from "lucide-react";
import { UserAvatar } from "../components/Avatar";
import { dmId, friendIds, otherInDm } from "../backend/store";
import type { ChatMessage } from "../backend/types";
import { useApp } from "../context";

interface ChatsScreenProps {
  onOpenRooms: () => void;
  onOpenStrangers: () => void;
}

export function previewOf(message: ChatMessage | undefined, mine: boolean) {
  if (!message) return "Say hi and start a conversation.";
  const prefix = mine ? "You: " : "";
  if (message.kind === "image") return `${prefix}📷 Photo`;
  if (message.kind === "voice") return `${prefix}🎤 Voice note`;
  if (message.kind === "invite") return `${prefix}🎮 ${message.invite?.title ?? "Game invite"}`;
  return `${prefix}${message.text ?? ""}`;
}

export function unreadCount(messages: ChatMessage[], reads: Record<string, number>, me: string, convId: string) {
  const seen = reads[`${me}|${convId}`] ?? 0;
  return messages.filter((m) => m.convId === convId && m.from !== me && m.createdAt > seen).length;
}

export default function ChatsScreen({ onOpenRooms, onOpenStrangers }: ChatsScreenProps) {
  const { db, me, openChat, nameOf } = useApp();
  const friends = friendIds(db, me.id);
  const lastByConv = new Map<string, ChatMessage>();
  for (const message of db.messages) {
    if (message.convId.startsWith("dm:") && message.convId.includes(me.id)) lastByConv.set(message.convId, message);
  }
  const convIds = new Set([...lastByConv.keys()].filter((id) => friends.includes(otherInDm(id, me.id))));
  const rows = [...convIds].sort((a, b) => (lastByConv.get(b)?.createdAt ?? 0) - (lastByConv.get(a)?.createdAt ?? 0));
  const startFriends = friends.filter((id) => !convIds.has(dmId(me.id, id)));

  return (
    <div className="screen chats-screen">
      <header className="page-header">
        <p className="eyebrow">Talk, share, play</p>
        <h1>Chats</h1>
        <p className="page-sub">
          <Lock size={13} /> Send photos, voice notes and game invites.
        </p>
      </header>

      <div className="explore-row">
        <button type="button" className="explore-card explore-card--pink" onClick={onOpenStrangers}>
          <Shuffle size={20} />
          <strong>Strangers</strong>
          <small>Random 1-on-1</small>
        </button>
        <button type="button" className="explore-card" onClick={onOpenRooms}>
          <UsersRound size={20} />
          <strong>Chat rooms</strong>
          <small>{db.rooms.length} open rooms</small>
        </button>
      </div>

      {rows.length > 0 && (
        <section className="card list-card" aria-label="Conversations">
          {rows.map((convId) => {
            const friend = otherInDm(convId, me.id);
            const last = lastByConv.get(convId);
            const unread = unreadCount(db.messages, db.reads, me.id, convId);
            return (
              <button key={convId} type="button" className="chat-row" onClick={() => openChat(convId)}>
                <UserAvatar id={friend} size={50} />
                <span className="chat-row-body">
                  <span className="chat-row-top">
                    <strong>
                      {nameOf(friend)}
                      {me.partnerId === friend && <Heart size={12} fill="currentColor" className="chat-partner-heart" />}
                    </strong>
                    <time>{last ? new Date(last.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "New"}</time>
                  </span>
                  <span className="chat-row-snippet">
                    {previewOf(last, last?.from === me.id)}
                    {unread > 0 && <span className="badge badge--inline">{unread}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      )}

      {startFriends.length > 0 && (
        <section className="start-section">
          <div className="section-head">
            <h3>Start a chat</h3>
          </div>
          <div className="start-row">
            {startFriends.map((id) => (
              <button key={id} type="button" className="start-person" onClick={() => openChat(dmId(me.id, id))}>
                <UserAvatar id={id} size={54} />
                <span>{nameOf(id)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {friends.length === 0 && (
        <button type="button" className="card empty-cta" onClick={onOpenStrangers}>
          <span>No friends yet. Meet someone new in Strangers or add a friend by username.</span>
          <ChevronRight size={16} />
        </button>
      )}

      <p className="chats-note">
        <Lock size={12} /> Only friends you accept can message you directly.
      </p>
    </div>
  );
}
