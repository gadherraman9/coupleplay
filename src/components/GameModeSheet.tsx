import { useState } from "react";
import { Bot, Globe2, UserRound } from "lucide-react";
import { friendIds } from "../backend/store";
import { useApp } from "../context";
import { gameById } from "../games/registry";
import { UserAvatar } from "./Avatar";
import Sheet from "./Sheet";

interface GameModeSheetProps {
  gameId: string;
  onClose: () => void;
  onFindStrangers: (gameId: string) => void;
}

export default function GameModeSheet({ gameId, onClose, onFindStrangers }: GameModeSheetProps) {
  const { db, me, playGame, nameOf } = useApp();
  const def = gameById(gameId);
  const [bots, setBots] = useState(1);
  const [step, setStep] = useState<"mode" | "friend">("mode");
  if (!def) return null;
  const friends = friendIds(db, me.id);

  const solo = () => {
    playGame(def.id, def.soloOnly ? [] : Array.from({ length: bots }, (_, i) => `ai:${i + 1}`));
    onClose();
  };

  return (
    <Sheet title={`${def.emoji} ${def.title}`} onClose={onClose}>
      {step === "mode" ? (
        <div className="mode-list">
          <div className="mode-option">
            <span className="mode-icon"><Bot size={20} /></span>
            <span className="mode-body">
              <strong>{def.soloOnly ? "Play solo" : "Solo vs bots"}</strong>
              <small>{def.soloOnly ? "Beat your high score" : "Practice any time, no waiting"}</small>
              {!def.soloOnly && def.maxPlayers > 2 && (
                <span className="bot-count">
                  {Array.from({ length: def.maxPlayers - 1 }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" className={bots === n ? "is-active" : ""} onClick={() => setBots(n)}>
                      {n} bot{n > 1 ? "s" : ""}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <button type="button" className="mode-go" onClick={solo}>Play</button>
          </div>
          {!def.soloOnly && (
            <>
              <button type="button" className="mode-option" onClick={() => setStep("friend")}>
                <span className="mode-icon"><UserRound size={20} /></span>
                <span className="mode-body">
                  <strong>With a friend</strong>
                  <small>Sends an invite in your chat</small>
                </span>
              </button>
              <button
                type="button"
                className="mode-option"
                onClick={() => {
                  onFindStrangers(def.id);
                  onClose();
                }}
              >
                <span className="mode-icon"><Globe2 size={20} /></span>
                <span className="mode-body">
                  <strong>With strangers</strong>
                  <small>Get matched with someone online</small>
                </span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="friend-pick">
          {friends.length === 0 && <p className="sheet-note">Add friends from the Friends tab first.</p>}
          {friends.map((id) => (
            <button
              key={id}
              type="button"
              className="friend-row friend-row--button"
              onClick={() => {
                playGame(def.id, [id], `dm:${[me.id, id].sort().join(":")}`);
                onClose();
              }}
            >
              <UserAvatar id={id} size={40} />
              <span className="friend-body">
                <strong>{nameOf(id)}</strong>
              </span>
              <span className="mode-go">Invite</span>
            </button>
          ))}
          <button type="button" className="text-link" onClick={() => setStep("mode")}>Back</button>
        </div>
      )}
    </Sheet>
  );
}
