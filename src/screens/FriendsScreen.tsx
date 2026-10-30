import { useState } from "react";
import type { FormEvent } from "react";
import { AtSign, Ban, Check, Copy, Flag, Heart, MessageCircle, UserPlus, X } from "lucide-react";
import { UserAvatar } from "../components/Avatar";
import SafetySheet from "../components/SafetySheet";
import { api, dmId, friendIds, isOnline, lastSeenText } from "../backend/store";
import { attempt, useApp } from "../context";

export default function FriendsScreen({ onSignUp }: { onSignUp: () => void }) {
  const { db, me, notify, openChat, nameOf } = useApp();
  const [username, setUsername] = useState("");
  const [query, setQuery] = useState("");
  const [safety, setSafety] = useState<{ id: string; mode: "block" | "report" } | null>(null);

  const incoming = db.requests.filter((r) => r.to === me.id && db.users[r.from] && !db.users[r.from].suspended);
  const sent = db.requests.filter((r) => r.from === me.id);
  const needle = query.trim().toLowerCase();
  const friends = friendIds(db, me.id).filter((id) => {
    const user = db.users[id];
    return !needle || user?.displayName.toLowerCase().includes(needle) || user?.username.includes(needle);
  });
  const blocked = db.blocks.filter((b) => b.by === me.id);

  const sendRequest = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim()) return;
    attempt(notify, () => {
      const { target, accepted } = api.sendFriendRequest(me.id, username);
      notify(accepted ? `You and ${target.displayName} are now friends` : `Request sent to @${target.username}`);
      setUsername("");
    });
  };

  const copyUsername = () => {
    void navigator.clipboard?.writeText(`@${me.username}`).then(
      () => notify("Username copied"),
      () => notify(`Your username is @${me.username}`),
    );
  };

  return (
    <div className="screen friends-screen">
      <header className="page-header">
        <p className="eyebrow">Your circle</p>
        <h1>Friends</h1>
        <button type="button" className="my-handle" onClick={copyUsername}>
          <AtSign size={13} /> {me.username} <Copy size={12} />
        </button>
      </header>

      {me.isGuest && (
        <button type="button" className="guest-banner" onClick={onSignUp}>
          <strong>You're a guest</strong>
          <span>Sign up so you don't lose your friends and chats.</span>
        </button>
      )}

      <form className="add-friend" onSubmit={sendRequest}>
        <label className="search-box">
          <UserPlus size={17} />
          <input
            placeholder="Add friend by @username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-label="Friend's username"
            autoCapitalize="none"
          />
        </label>
        <button type="submit" className="accept-btn" disabled={!username.trim()}>
          Send
        </button>
      </form>

      {incoming.length > 0 && (
        <section className="friends-section">
          <div className="section-head">
            <h3>Friend requests</h3>
            <span className="count-pill">{incoming.length}</span>
          </div>
          <div className="request-list">
            {incoming.map((request) => (
              <div key={request.id} className="request-card">
                <UserAvatar id={request.from} size={46} />
                <div className="request-body">
                  <strong>{nameOf(request.from)}</strong>
                  <span>@{db.users[request.from].username}</span>
                </div>
                <div className="request-actions">
                  <button
                    type="button"
                    className="accept-btn"
                    onClick={() => {
                      api.acceptRequest(request.id);
                      notify(`${nameOf(request.from)} is now your friend`);
                      if (me.isGuest) window.setTimeout(() => notify("Tip: sign up so you never lose your friends"), 2600);
                    }}
                    aria-label={`Accept ${nameOf(request.from)}'s friend request`}
                  >
                    <Check size={16} strokeWidth={3} />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    className="decline-btn"
                    onClick={() => api.declineRequest(request.id)}
                    aria-label={`Decline ${nameOf(request.from)}'s friend request`}
                  >
                    <X size={16} />
                  </button>
                  <button
                    type="button"
                    className="decline-btn"
                    onClick={() => setSafety({ id: request.from, mode: "block" })}
                    aria-label={`Block ${nameOf(request.from)}`}
                  >
                    <Ban size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {sent.length > 0 && (
        <section className="friends-section">
          <div className="section-head">
            <h3>Sent requests</h3>
          </div>
          <div className="card list-card">
            {sent.map((request) => (
              <div key={request.id} className="friend-row">
                <UserAvatar id={request.to} size={40} />
                <div className="friend-body">
                  <strong>{nameOf(request.to)}</strong>
                  <span className="friend-status">Waiting for them to accept</span>
                </div>
                <button type="button" className="text-link" onClick={() => api.declineRequest(request.id)}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="friends-section">
        <div className="section-head">
          <h3>All friends</h3>
          <span className="count-pill">{friends.length}</span>
        </div>
        {friendIds(db, me.id).length > 4 && (
          <label className="search-box search-box--small">
            <input type="search" placeholder="Search friends" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        )}
        <div className="card list-card friend-list">
          {friends.map((id) => (
            <div key={id} className="friend-row">
              <UserAvatar id={id} size={46} />
              <div className="friend-body">
                <strong>
                  {nameOf(id)}
                  {me.partnerId === id && (
                    <span className="partner-badge">
                      <Heart size={10} fill="currentColor" /> Partner
                    </span>
                  )}
                  {db.users[id]?.isBot && <span className="bot-tag">demo bot</span>}
                </strong>
                <span className="friend-status">
                  {isOnline(db, id) ? <span className="online-dot" /> : null}
                  {isOnline(db, id) ? "Online now" : db.presence[id] ? lastSeenText(db, id) : `@${db.users[id]?.username}`}
                </span>
              </div>
              <button type="button" className="icon-ghost" onClick={() => setSafety({ id, mode: "report" })} aria-label={`Report ${nameOf(id)}`}>
                <Flag size={15} />
              </button>
              <button type="button" className="icon-ghost" onClick={() => setSafety({ id, mode: "block" })} aria-label={`Block ${nameOf(id)}`}>
                <Ban size={15} />
              </button>
              <button type="button" className="message-btn" onClick={() => openChat(dmId(me.id, id))} aria-label={`Message ${nameOf(id)}`}>
                <MessageCircle size={17} />
              </button>
            </div>
          ))}
          {friends.length === 0 && (
            <div className="friends-empty">
              <UserPlus size={18} />
              <p>No friends yet. Add someone by their username above.</p>
            </div>
          )}
        </div>
      </section>

      {blocked.length > 0 && (
        <section className="friends-section">
          <div className="section-head">
            <h3>Blocked</h3>
            <span className="count-pill">{blocked.length}</span>
          </div>
          <div className="card list-card">
            {blocked.map((block) => (
              <div key={block.target} className="friend-row">
                <UserAvatar id={block.target} size={40} showOnline={false} />
                <div className="friend-body">
                  <strong>{nameOf(block.target)}</strong>
                  <span className="friend-status">Reason: {block.reason}</span>
                </div>
                <button type="button" className="text-link" onClick={() => { api.unblock(me.id, block.target); notify(`Unblocked ${nameOf(block.target)}`); }}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {safety && <SafetySheet targetId={safety.id} mode={safety.mode} onClose={() => setSafety(null)} />}
    </div>
  );
}
