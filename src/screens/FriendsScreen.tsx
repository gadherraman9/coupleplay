import { useState } from "react";
import { Check, Heart, MessageCircle, Search, SearchX, UserPlus, X } from "lucide-react";
import Avatar from "../components/Avatar";
import type { Friend, FriendRequest } from "../data";

interface FriendsScreenProps {
  friends: Friend[];
  requests: FriendRequest[];
  onAccept: (request: FriendRequest) => void;
  onDecline: (id: string) => void;
  onMessage: (friendId: string) => void;
}

export default function FriendsScreen({
  friends,
  requests,
  onAccept,
  onDecline,
  onMessage,
}: FriendsScreenProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visibleRequests = requests.filter((request) =>
    request.name.toLowerCase().includes(needle),
  );
  const visibleFriends = friends.filter((friend) => friend.name.toLowerCase().includes(needle));
  const noMatches = needle.length > 0 && visibleFriends.length === 0 && visibleRequests.length === 0;

  return (
    <div className="screen friends-screen">
      <header className="page-header">
        <p className="eyebrow">Your circle</p>
        <h1>Friends</h1>
        <p className="page-sub">Connect with the people who matter most.</p>
      </header>

      <label className="search-box">
        <Search size={17} />
        <input
          type="search"
          placeholder="Search friends by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search friends"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={15} />
          </button>
        )}
      </label>

      {requests.length > 0 && visibleRequests.length > 0 && (
        <section className="friends-section">
          <div className="section-head">
            <h3>Friend requests</h3>
            <span className="count-pill">{visibleRequests.length}</span>
          </div>
          <div className="request-list">
            {visibleRequests.map((request) => (
              <div key={request.id} className="request-card">
                <Avatar initials={request.initials} hue={request.hue} size={46} />
                <div className="request-body">
                  <strong>{request.name}</strong>
                  <span>
                    <UserPlus size={12} /> {request.mutual} mutual friends
                  </span>
                </div>
                <div className="request-actions">
                  <button
                    type="button"
                    className="accept-btn"
                    onClick={() => onAccept(request)}
                    aria-label={`Accept ${request.name}'s friend request`}
                  >
                    <Check size={16} strokeWidth={3} />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    className="decline-btn"
                    onClick={() => onDecline(request.id)}
                    aria-label={`Decline ${request.name}'s friend request`}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="friends-section">
        <div className="section-head">
          <h3>All friends</h3>
          <span className="count-pill">{visibleFriends.length}</span>
        </div>
        <div className="card list-card friend-list">
          {visibleFriends.map((friend) => (
            <div key={friend.id} className="friend-row">
              <Avatar initials={friend.initials} hue={friend.hue} size={46} online={friend.online} />
              <div className="friend-body">
                <strong>
                  {friend.name}
                  {friend.partner && (
                    <span className="partner-badge">
                      <Heart size={10} fill="currentColor" /> Partner
                    </span>
                  )}
                </strong>
                <span className="friend-status">
                  {friend.online ? <span className="online-dot" /> : null}
                  {friend.online ? "Online now" : "Offline"}
                </span>
              </div>
              <button
                type="button"
                className="message-btn"
                onClick={() => onMessage(friend.id)}
                aria-label={`Message ${friend.name}`}
              >
                <MessageCircle size={17} />
              </button>
            </div>
          ))}
          {visibleFriends.length === 0 && !noMatches && (
            <div className="friends-empty">
              <UserPlus size={18} />
              <p>No friends yet. Accept a request to get started.</p>
            </div>
          )}
        </div>
      </section>

      {noMatches && (
        <div className="no-results">
          <SearchX size={22} />
          <strong>No one found</strong>
          <p>Try another name or send a new invite.</p>
        </div>
      )}
    </div>
  );
}
