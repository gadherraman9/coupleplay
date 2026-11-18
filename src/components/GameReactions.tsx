import { useEffect, useState } from "react";
import { Smile, X } from "lucide-react";
import { api } from "../backend/store";
import { attempt, useApp } from "../context";

const REACTIONS = ["❤️", "😂", "👏", "😮", "Nice move!", "Rematch?"];

export default function GameReactions({ convId, multiplayer }: { convId: string; multiplayer: boolean }) {
  const { me, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState("");
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => { setCooldown(false); setBubble(""); }, 2500);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const react = (text: string) => {
    if (cooldown) return;
    if (multiplayer) {
      const sent = attempt(notify, () => api.sendMessage(me.id, convId, { kind: "text", text }));
      if (!sent) return;
    }
    setBubble(text);
    setCooldown(true);
    setOpen(false);
  };
  return <div className="game-reactions">
    <button type="button" className="round-btn" aria-label={open ? "Close reactions" : "Send a reaction"} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? <X size={17} /> : <Smile size={17} />}
    </button>
    {bubble && <span className="reaction-pop" role="status">{bubble}</span>}
    {open && <div className="reaction-picker" role="group" aria-label="Quick reactions">
      {REACTIONS.map(text => <button key={text} type="button" disabled={cooldown} onClick={() => react(text)}>{text}</button>)}
      {!multiplayer && <small>Practice reactions · visible only to you</small>}
    </div>}
  </div>;
}
