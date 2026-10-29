import { Heart, Lock } from "lucide-react";
import Avatar from "../components/Avatar";
import type { Conversation, Friend } from "../data";

interface ChatsScreenProps {
  conversations: Conversation[];
  friends: Friend[];
  onOpenChat: (friendId: string) => void;
}

export default function ChatsScreen({ conversations, friends, onOpenChat }: ChatsScreenProps) {
  const friendById = (id: string) => friends.find((friend) => friend.id === id);
  const startFriends = friends.filter(
    (friend) => !conversations.some((conversation) => conversation.friendId === friend.id),
  );

  return (
    <div className="screen chats-screen">
      <header className="page-header">
        <p className="eyebrow">Just the two of you</p>
        <h1>Chats</h1>
        <p className="page-sub">
          <Lock size={13} /> Private messages, games and invites.
        </p>
      </header>

      <section className="card list-card" aria-label="Conversations">
        {conversations.map((conversation) => {
          const friend = friendById(conversation.friendId);
          if (!friend) return null;
          const last = conversation.messages[conversation.messages.length - 1];
          const preview = last
            ? (last.text ?? `Game invite · ${last.invite?.title ?? "Play with me"}`)
            : "Say hi and start a conversation.";
          return (
            <button
              key={conversation.friendId}
              type="button"
              className="chat-row"
              onClick={() => onOpenChat(friend.id)}
            >
              <Avatar initials={friend.initials} hue={friend.hue} size={50} online={friend.online} />
              <span className="chat-row-body">
                <span className="chat-row-top">
                  <strong>
                    {friend.name}
                    {friend.partner && (
                      <Heart size={12} fill="currentColor" className="chat-partner-heart" />
                    )}
                  </strong>
                  <time>{last?.time ?? "New"}</time>
                </span>
                <span className="chat-row-snippet">{preview}</span>
              </span>
            </button>
          );
        })}
      </section>

      {startFriends.length > 0 && (
        <section className="start-section">
          <div className="section-head">
            <h3>Start a chat</h3>
          </div>
          <div className="start-row">
            {startFriends.map((friend) => (
              <button
                key={friend.id}
                type="button"
                className="start-person"
                onClick={() => onOpenChat(friend.id)}
              >
                <Avatar initials={friend.initials} hue={friend.hue} size={54} online={friend.online} />
                <span>{friend.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="chats-note">
        <Lock size={12} /> Only friends you accept can message you.
      </p>
    </div>
  );
}
