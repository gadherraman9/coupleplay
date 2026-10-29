import { useEffect, useRef, useState } from "react";
import { Globe2, X } from "lucide-react";
import { api } from "../backend/store";
import { useApp } from "../context";
import { gameById } from "../games/registry";

const BOT_FALLBACK_AFTER = 10;

export default function Matchmaking({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { db, me, openGame, playGame } = useApp();
  const def = gameById(gameId);
  const since = useRef(Date.now());
  const [waited, setWaited] = useState(0);
  const done = useRef(false);
  // Callbacks change on every database update; keep the latest without restarting the search.
  const latest = useRef({ openGame, playGame, onClose });
  latest.current = { openGame, playGame, onClose };

  useEffect(() => {
    if (done.current) return;
    const found = db.games.find((g) => g.game === gameId && g.createdAt >= since.current && g.players.includes(me.id) && g.host !== me.id);
    if (found) {
      done.current = true;
      latest.current.openGame(found.id);
      latest.current.onClose();
    }
  }, [db.games, gameId, me.id]);

  useEffect(() => {
    const tick = () => {
      if (done.current) return;
      setWaited((value) => value + 1);
      try {
        const opponent = api.findGameMatch(me.id, gameId);
        if (opponent) {
          done.current = true;
          latest.current.playGame(gameId, [opponent]);
          latest.current.onClose();
        }
      } catch {
        /* try again next tick */
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
      api.leaveQueue(me.id);
    };
  }, [gameId, me.id]);

  if (!def) return null;
  return (
    <div className="game-overlay matchmaking">
      <header className="game-topbar">
        <button type="button" className="round-btn" onClick={onClose} aria-label="Cancel">
          <X size={19} />
        </button>
        <div className="game-topbar-title">
          <h2>{def.emoji} {def.title}</h2>
          <p>Play with strangers</p>
        </div>
      </header>
      <div className="stranger-lobby">
        <div className="radar is-searching">
          <Globe2 size={34} />
        </div>
        <h2>Finding a player…</h2>
        <p>{waited}s · Anyone who picks {def.title} → With strangers will be matched with you.</p>
        {waited >= BOT_FALLBACK_AFTER && (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              done.current = true;
              playGame(gameId, ["ai:1"]);
              onClose();
            }}
          >
            No one yet — play a bot instead
          </button>
        )}
      </div>
    </div>
  );
}
