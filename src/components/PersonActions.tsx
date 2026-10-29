import { useState } from "react";
import { Ban, Flag, UserPlus } from "lucide-react";
import { api, areFriends } from "../backend/store";
import { attempt, useApp } from "../context";
import { UserAvatar } from "./Avatar";
import SafetySheet from "./SafetySheet";

// One row with "add friend", "report" and "block" for someone you met.
export default function PersonActions({ id, onBlocked }: { id: string; onBlocked?: () => void }) {
  const { db, me, notify, nameOf } = useApp();
  const [safety, setSafety] = useState<"block" | "report" | null>(null);
  const user = db.users[id];
  if (!user) return null;
  const friends = areFriends(db, me.id, id);
  const pending = db.requests.some((r) => r.from === me.id && r.to === id);

  return (
    <div className="friend-row">
      <UserAvatar id={id} size={40} />
      <div className="friend-body">
        <strong>
          {nameOf(id)} {user.isBot && <span className="bot-tag">demo bot</span>}
        </strong>
        <span className="friend-status">@{user.username}</span>
      </div>
      {!friends && (
        <button
          type="button"
          className="icon-ghost"
          disabled={pending}
          onClick={() =>
            attempt(notify, () => {
              const { accepted } = api.sendFriendRequest(me.id, user.username);
              notify(accepted ? `You're now friends with ${nameOf(id)}` : "Friend request sent");
            })
          }
          aria-label={`Add ${nameOf(id)} as friend`}
          title={pending ? "Request sent" : "Add friend"}
        >
          <UserPlus size={16} />
        </button>
      )}
      <button type="button" className="icon-ghost" onClick={() => setSafety("report")} aria-label={`Report ${nameOf(id)}`}>
        <Flag size={15} />
      </button>
      <button type="button" className="icon-ghost" onClick={() => setSafety("block")} aria-label={`Block ${nameOf(id)}`}>
        <Ban size={15} />
      </button>
      {safety && <SafetySheet targetId={id} mode={safety} onClose={() => setSafety(null)} onDone={safety === "block" ? onBlocked : undefined} />}
    </div>
  );
}
