import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Gamepad2, Lock, Send, Sparkles } from "lucide-react";
import Avatar from "../components/Avatar";
import type { Friend, GameId, Message } from "../data";

interface ChatScreenProps {
  friend: Friend;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
  onOpenGame: (game: GameId) => void;
}

const QUICK_REPLIES = ["I miss you", "Let's play Truth or Dare", "You're my favorite"];

export default function ChatScreen({ friend, messages, onBack, onSend, onOpenGame }: ChatScreenProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitDraft();
  };

  const sendQuickReply = (text: string) => {
    onSend(text);
  };

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button type="button" className="round-btn" onClick={onBack} aria-label="Back to chats">
          <ArrowLeft size={19} />
        </button>
        <div className="chat-person">
          <Avatar initials={friend.initials} hue={friend.hue} size={40} online={friend.online} />
          <div>
            <strong>{friend.name}</strong>
            <span className={friend.online ? "is-online" : ""}>
              {friend.online ? "Online now" : friend.partner ? "Your partner" : "Friend"}
            </span>
          </div>
        </div>
        <span className="chat-lock" title="Private chat">
          <Lock size={15} />
        </span>
      </header>

      <div className="chat-body">
        <div className="chat-day">Today</div>

        {messages.length === 0 && (
          <div className="chat-empty">
            <span>
              <Sparkles size={20} />
            </span>
            <strong>Say hi to {friend.name}</strong>
            <p>This chat is private. Send the first message and break the ice.</p>
          </div>
        )}

        {messages.map((message) => {
          if (message.invite) {
            return (
              <div key={message.id} className="msg msg--them">
                <div className="invite-card">
                  <span className="invite-card-icon">
                    <Gamepad2 size={19} />
                  </span>
                  <div className="invite-card-body">
                    <small>Game invite</small>
                    <strong>{message.invite.title}</strong>
                    <p>{message.invite.subtitle}</p>
                  </div>
                  <button type="button" onClick={() => onOpenGame(message.invite!.game)}>
                    Play
                  </button>
                </div>
                <span className="msg-time">{message.time}</span>
              </div>
            );
          }
          return (
            <div key={message.id} className={`msg msg--${message.from}`}>
              <div className="bubble">{message.text}</div>
              <span className="msg-time">{message.time}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-composer">
        <div className="quick-replies">
          {QUICK_REPLIES.map((reply) => (
            <button key={reply} type="button" onClick={() => sendQuickReply(reply)}>
              {reply}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitDraft();
              }
            }}
            placeholder={`Message ${friend.name}...`}
            aria-label={`Message ${friend.name}`}
            maxLength={500}
          />
          <button
            type="submit"
            className="send-btn"
            aria-label="Send message"
            disabled={!draft.trim()}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
