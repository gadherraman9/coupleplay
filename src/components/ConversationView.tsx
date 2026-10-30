import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Gamepad2, ImagePlus, Mic, Pause, Play, Send, Sparkles, Trash2, X } from "lucide-react";
import { api, uploadChatMedia } from "../backend/store";
import type { ChatMessage } from "../backend/types";
import { attempt, useApp } from "../context";
import { gameById } from "../games/registry";
import { compressImage, formatSeconds, MAX_VOICE_SECONDS, useMediaSrc, useVoiceRecorder } from "../lib/media";
import { chatThemeStyle } from "../themes";
import { UserAvatar } from "./Avatar";

interface ConversationViewProps {
  convId: string;
  group?: boolean;
  compact?: boolean;
  blockedReason?: string;
  emptyTitle?: string;
  quickReplies?: string[];
}

function ChatPhoto({ src, alt, onOpen }: { src: string; alt: string; onOpen: (url: string) => void }) {
  const url = useMediaSrc(src);
  return (
    <button type="button" className="photo-btn" onClick={() => url && onOpen(url)}>
      {url ? <img src={url} alt={alt} /> : <span className="photo-loading">Loading photo…</span>}
    </button>
  );
}

function VoiceNote({ src, duration }: { src: string; duration?: number }) {
  const url = useMediaSrc(src);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  return (
    <span className="voice-note">
      <button
        type="button"
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <span className="voice-wave">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ height: `${30 + ((i * 37) % 70)}%`, opacity: i / 18 < progress ? 1 : 0.45 }} />
        ))}
      </span>
      <small>{formatSeconds(duration ?? 0)}</small>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const total = Number.isFinite(el.duration) ? el.duration : duration ?? 1;
          setProgress(el.currentTime / total);
        }}
      />
    </span>
  );
}

export default function ConversationView({
  convId,
  group,
  compact,
  blockedReason,
  emptyTitle = "Say hi!",
  quickReplies,
}: ConversationViewProps) {
  const { db, me, notify, nameOf, openGame } = useApp();
  const [draft, setDraft] = useState("");
  const [viewer, setViewer] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(
    () =>
      db.messages.filter(
        (m) => m.convId === convId && (m.from === me.id || !db.blocks.some((b) => b.by === me.id && b.target === m.from)),
      ),
    [db.messages, db.blocks, convId, me.id],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    api.markRead(me.id, convId);
  }, [messages.length, convId, me.id]);

  const send = useCallback(
    (message: Omit<ChatMessage, "id" | "convId" | "from" | "createdAt">) =>
      attempt(notify, () => {
        api.sendMessage(me.id, convId, message);
      }),
    [notify, me.id, convId],
  );

  const recorder = useVoiceRecorder(
    useCallback(
      (dataUrl: string, duration: number) => {
        uploadChatMedia(convId, dataUrl).then(
          (media) => send({ kind: "voice", media, duration }),
          (error: Error) => notify(error.message),
        );
      },
      [send, convId, notify],
    ),
    notify,
  );

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (send({ kind: "text", text })) setDraft("");
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setSending(true);
    try {
      const media = await uploadChatMedia(convId, await compressImage(file));
      send({ kind: "image", media, text: draft.trim() || undefined });
      setDraft("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't send photo");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className={`conversation ${compact ? "conversation--compact" : ""}`} style={chatThemeStyle(me.chatTheme)}>
      <div className="chat-body">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span>
              <Sparkles size={20} />
            </span>
            <strong>{emptyTitle}</strong>
            <p>Send a message, a photo or a voice note.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const mine = message.from === me.id;
          const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          if (message.kind === "system") {
            return (
              <div key={message.id} className="chat-day">
                {message.text}
              </div>
            );
          }
          const showName = group && !mine && messages[index - 1]?.from !== message.from;
          let body;
          if (message.kind === "invite" && message.invite) {
            const def = gameById(message.invite.game);
            body = (
              <div className="invite-card">
                <span className="invite-card-icon">{def?.emoji ?? <Gamepad2 size={19} />}</span>
                <div className="invite-card-body">
                  <small>Game invite</small>
                  <strong>{message.invite.title}</strong>
                  <p>{mine ? "You sent an invite" : `${nameOf(message.from)} wants to play`}</p>
                </div>
                {message.invite.sessionId && (
                  <button type="button" onClick={() => openGame(message.invite!.sessionId!)}>
                    {mine ? "Open" : "Play"}
                  </button>
                )}
              </div>
            );
          } else if (message.kind === "image" && message.media) {
            body = (
              <div className="bubble bubble--media">
                <ChatPhoto src={message.media} alt={`Photo from ${nameOf(message.from)}`} onOpen={setViewer} />
                {message.text && <span className="photo-caption">{message.text}</span>}
              </div>
            );
          } else if (message.kind === "voice" && message.media) {
            body = (
              <div className="bubble">
                <VoiceNote src={message.media} duration={message.duration} />
              </div>
            );
          } else {
            body = <div className="bubble">{message.text}</div>;
          }
          return (
            <div key={message.id} className={`msg msg--${mine ? "me" : "them"} ${group && !mine ? "msg--group" : ""}`}>
              {showName && (
                <span className="msg-author">
                  <UserAvatar id={message.from} size={18} showOnline={false} /> {nameOf(message.from)}
                </span>
              )}
              {body}
              <span className="msg-time">
                {time}
                {mine && (
                  <button
                    type="button"
                    className="msg-delete"
                    onClick={() => api.deleteMessage(me.id, message.id)}
                    aria-label="Delete message"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-composer">
        {blockedReason ? (
          <p className="composer-blocked">{blockedReason}</p>
        ) : (
          <>
            {quickReplies && (
              <div className="quick-replies">
                {quickReplies.map((reply) => (
                  <button key={reply} type="button" onClick={() => send({ kind: "text", text: reply })}>
                    {reply}
                  </button>
                ))}
              </div>
            )}
            {recorder.recording ? (
              <div className="recording-bar">
                <span className="rec-dot" />
                <strong>{formatSeconds(recorder.seconds)}</strong>
                <small>/ {formatSeconds(MAX_VOICE_SECONDS)}</small>
                <button type="button" className="round-btn round-btn--small" onClick={() => recorder.stop(true)} aria-label="Cancel voice note">
                  <X size={16} />
                </button>
                <button type="button" className="send-btn" onClick={() => recorder.stop(false)} aria-label="Send voice note">
                  <Send size={18} />
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void pickPhoto(event.target.files?.[0])}
                />
                <button
                  type="button"
                  className="composer-icon"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending}
                  aria-label="Send a photo"
                >
                  <ImagePlus size={19} />
                </button>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={sending ? "Sending photo…" : "Message…"}
                  aria-label="Message"
                  maxLength={500}
                />
                {draft.trim() ? (
                  <button type="submit" className="send-btn" aria-label="Send message">
                    <Send size={18} />
                  </button>
                ) : (
                  <button type="button" className="send-btn send-btn--mic" onClick={() => void recorder.start()} aria-label="Record a voice note">
                    <Mic size={18} />
                  </button>
                )}
              </form>
            )}
          </>
        )}
      </div>

      {viewer && (
        <button type="button" className="photo-viewer" onClick={() => setViewer(null)} aria-label="Close photo">
          <img src={viewer} alt="" />
        </button>
      )}
    </div>
  );
}
