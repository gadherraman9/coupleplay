import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Music, Music2, RefreshCw, Sparkles, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { SkinPicker, skinKindOf } from "./GamePage";
import Sheet from "./Sheet";
import { isMusicOn, onMusicChange, setMusicOn, startMusic, stopMusic } from "../games/music";
import { api, areFriends } from "../backend/store";
import { attempt, useApp } from "../context";
import { botName, gameById } from "../games/registry";
import { isBotPlayer } from "../games/types";
import { isMuted, onMuteChange, play, setMuted } from "../games/sfx";
import { Confetti } from "../games/ui";
import { useFelt } from "../games/deck";
import { ClipPlayer } from "../games/clips";
import ConversationView from "./ConversationView";
import { UserAvatar } from "./Avatar";
import PlayerProfileSheet from "./PlayerProfileSheet";

const BUBBLE_MS = 5000;
const GAME_PHRASES = ["Good game! 🤝", "Nice move 👏", "Your turn ⏳", "Rematch? 🔁", "😂", "😡"];

export default function GameHost({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { db, me, notify, nameOf, playGame } = useApp();
  const session = db.games.find((g) => g.id === sessionId);
  const def = session ? gameById(session.game) : undefined;
  const [chatOpen, setChatOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [, setNow] = useState(0);
  const seenMessages = useRef<number | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const felt = useFelt();
  // A quick dice-roll clip when a fresh Ludo / Snakes game opens.
  const [diceIntro, setDiceIntro] = useState(() => {
    const s = db.games.find((g) => g.id === sessionId);
    return Boolean(s && (s.game === "ludo" || s.game === "snakes") && s.rev === 0 && Date.now() - s.createdAt < 15_000);
  });

  useEffect(() => onMuteChange(setMutedState), []);
  const [music, setMusicState] = useState(isMusicOn());
  useEffect(() => onMusicChange(setMusicState), []);
  useEffect(() => {
    startMusic();
    return () => stopMusic();
  }, []);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const player of session?.players ?? []) {
      map[player] = player === me.id ? "You" : isBotPlayer(player) ? botName(player) : nameOf(player);
    }
    return map;
  }, [session?.players, me.id, nameOf]);

  const act = useCallback(
    (action: unknown) => {
      if (!def) return;
      attempt(notify, () =>
        api.updateGame(sessionId, (s) => {
          s.state = def.apply(s.state, action, me.id);
          s.winner = def.winner(s.state);
          if (s.winner) s.status = "finished";
        }),
      );
      const typed = action as { type?: string; score?: number };
      if (def.id === "bounce" && typed.type === "over" && typed.score) {
        const reward = Math.min(15, Math.floor(typed.score / 150));
        if (reward > 0) {
          api.addHearts(me.id, reward);
          notify(`+${reward} hearts for your bounce!`);
        }
      }
    },
    [def, sessionId, me.id, notify],
  );

  // The host's tab plays for the bots.
  const current = session && def?.currentPlayer ? def.currentPlayer(session.state) : null;
  const currentIsBot = Boolean(current && (isBotPlayer(current) || db.users[current]?.isBot));
  useEffect(() => {
    if (!session || !def?.botMove || session.status !== "playing" || session.host !== me.id) return;
    if (!current || !currentIsBot) return;
    const rev = session.rev;
    const timer = window.setTimeout(() => {
      try {
        api.updateGame(sessionId, (s) => {
          if (s.rev !== rev) return;
          const move = def.botMove!(s.state, current);
          if (!move) return;
          s.state = def.apply(s.state, move, current);
          s.winner = def.winner(s.state);
          if (s.winner) s.status = "finished";
        });
      } catch {
        /* game was closed */
      }
    }, def.botDelay ?? 900);
    return () => window.clearTimeout(timer);
    // Keyed on the game revision, not the session object: unrelated updates
    // (chat, presence) recreate the object and used to restart the bot timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.rev, session?.status, session?.host, def, current, me.id, sessionId, currentIsBot]);

  // Chime when it becomes my turn, fanfare when the game ends.
  const wasMyTurn = useRef(current === me.id);
  useEffect(() => {
    const mine = current === me.id && session?.status === "playing";
    if (mine && !wasMyTurn.current && !def?.soloOnly && (session?.players.length ?? 0) > 1) play("turn", 0.7);
    wasMyTurn.current = mine;
  }, [current, me.id, session?.status, def?.soloOnly, session?.players.length]);

  const endedRef = useRef(session?.status === "finished");
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (session?.status !== "finished" || endedRef.current || def?.soloOnly) return;
    endedRef.current = true;
    const won = session.winner === me.id;
    const timer = window.setTimeout(() => {
      play(won ? "win" : "lose");
      if (won) setCelebrate(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [session?.status, session?.winner, me.id, def?.soloOnly]);

  const rewardKey = `cp_reward_${sessionId}_${me.id}`;
  const [reward, setReward] = useState<ReturnType<typeof api.recordGame> | null>(null);
  useEffect(() => {
    if (session?.status !== "finished" || !def) return;
    try {
      if (localStorage.getItem(rewardKey)) return;
      localStorage.setItem(rewardKey, "1");
    } catch {
      /* storage blocked: reward anyway */
    }
    const result = api.recordGame(me.id, def.id, session.winner === me.id, Boolean(def.soloOnly));
    if (def.soloOnly) {
      if (result.levelUp) notify(`Level ${result.levelUp}! +${result.levelReward} hearts`);
      return;
    }
    const timer = window.setTimeout(() => {
      setReward(result);
      if (result.levelUp) play("levelup");
      else if (result.hearts) play("reward");
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [session?.status, session?.winner, me.id, rewardKey, notify, def]);

  const chatCount = db.messages.filter((m) => m.convId === session?.convId).length;
  useEffect(() => {
    if (chatOpen) seenMessages.current = chatCount;
    else if (seenMessages.current === null) seenMessages.current = chatCount;
  }, [chatOpen, chatCount]);
  const unread = !chatOpen && seenMessages.current !== null ? chatCount - seenMessages.current : 0;

  // Plato-style speech bubbles: the newest line each player said, for a few seconds.
  const bubbles = new Map<string, string>();
  for (const m of db.messages) {
    if (m.convId !== session?.convId || m.kind === "system" || Date.now() - m.createdAt > BUBBLE_MS) continue;
    bubbles.set(m.from, m.kind === "image" ? "📷 Photo" : m.kind === "voice" ? "🎤 Voice note" : m.kind === "invite" ? "🎮 Invite" : m.text ?? "");
  }
  const bubbleKey = [...bubbles.values()].join("|");
  useEffect(() => {
    if (!bubbleKey) return;
    const timer = window.setTimeout(() => setNow(Date.now()), BUBBLE_MS);
    return () => window.clearTimeout(timer);
  }, [bubbleKey]);

  if (!session || !def) {
    return (
      <div className="game-overlay">
        <header className="game-topbar">
          <button type="button" className="round-btn" onClick={onClose} aria-label="Close game">
            <X size={19} />
          </button>
          <div className="game-topbar-title">
            <h2>Game not found</h2>
          </div>
        </header>
      </div>
    );
  }

  const humans = session.players.filter((p) => !isBotPlayer(p) && !db.users[p]?.isBot);
  const opponents = session.players.filter((p) => p !== me.id);
  const View = def.View;
  const finished = session.status === "finished";
  const hasChat = humans.length > 1 || session.convId.startsWith("dm:");

  return (
    <div className="game-overlay" role="dialog" aria-modal="true" aria-label={def.title}>
      <header className="game-topbar">
        <button type="button" className="round-btn" onClick={onClose} aria-label="Close game">
          <X size={19} />
        </button>
        <div className="game-topbar-title">
          <h2>
            {def.emoji} {def.title}
          </h2>
          <p>
            {def.soloOnly
              ? "Solo play"
              : `with ${opponents.map((p) => names[p]).join(", ")}`}
          </p>
        </div>
        <button type="button" className="round-btn" onClick={() => setMuted(!muted)} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        {skinKindOf(def.id, def.felt) && (
          <button type="button" className="round-btn items-btn" onClick={() => setItemsOpen(true)} aria-label="Items: change skin">
            <Sparkles size={17} />
          </button>
        )}
        <button type="button" className={`round-btn ${music ? "" : "is-off"}`} onClick={() => setMusicOn(!music)} aria-label={music ? "Turn music off" : "Turn music on"}>
          {music ? <Music size={17} /> : <Music2 size={17} opacity={0.4} />}
        </button>
        {hasChat && (
          <button type="button" className="round-btn chat-toggle" onClick={() => setChatOpen((v) => !v)} aria-label="Chat while playing">
            <MessageCircle size={18} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
        )}
      </header>

      {!def.soloOnly && (
        <div className="game-players" aria-label="Players">
          {session.players.map((player) => (
            <button key={player} type="button" className={`game-player ${player === current ? "is-turn" : ""}`} onClick={() => setProfile(player)}>
              <UserAvatar id={player} size={38} />
              <span className="game-player-name">
                {names[player]}
                {player !== me.id && !isBotPlayer(player) && !db.users[player]?.isBot && !areFriends(db, me.id, player) && <i className="game-player-tag">new</i>}
              </span>
              {bubbles.get(player) && <span key={bubbles.get(player)} className="speech-bubble">{bubbles.get(player)}</span>}
              {player === current && !finished && (
                <span className="turn-pill">
                  {player === me.id ? "Your turn" : "Playing…"}
                  <i key={session.rev} className="turn-timer" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className={`game-body game-body--board game-table--${def.id} ${def.felt ? "game-table--felt" : ""}`} style={def.felt ? felt : undefined}>
        <View state={session.state} me={me.id} players={session.players} names={names} act={act} finished={finished} />

        {diceIntro && (
          <div className="clip-splash" onClick={() => setDiceIntro(false)}>
            <ClipPlayer name="dice" rate={1.4} maxMs={3200} onEnd={() => setDiceIntro(false)} />
            <strong>Let's roll! 🎲</strong>
          </div>
        )}

        {finished && !def.soloOnly && (
          <div className={`win-banner ${session.winner === me.id ? "is-win" : ""}`}>
            {session.winner === me.id && <ClipPlayer name="win" className="win-clip" hold />}
            <strong className="win-title">{session.winner === me.id ? "YOU WON! 🎉" : `${(names[session.winner ?? ""] ?? "Someone").toUpperCase()} WON!`}</strong>
            <div className="win-cards">
              {[...session.players]
                .sort((a, b) => (a === session.winner ? -1 : b === session.winner ? 1 : 0))
                .slice(0, 4)
                .map((player, i) => (
                  <span key={player} className={`win-card ${player === session.winner ? "is-winner" : ""}`} style={{ ["--tilt" as string]: `${(i % 2 ? 1 : -1) * (4 + i)}deg` }}>
                    <b>{names[player]}</b>
                    <UserAvatar id={player} size={64} showOnline={false} />
                    {player === session.winner ? (
                      <span className="win-medal">
                        <Trophy size={20} />
                      </span>
                    ) : (
                      <em>OUT</em>
                    )}
                  </span>
                ))}
            </div>
            {reward && (
              <span className="reward-strip">
                {reward.hearts > 0 && <span className="reward-hearts">+{reward.hearts} ❤</span>}
                <span className="reward-xp">+{session.winner === me.id ? 40 : 10} XP</span>
                {reward.streak > 1 && <span className="reward-streak">🔥 {reward.streak} wins in a row{reward.bonus ? ` (+${reward.bonus})` : ""}</span>}
                {reward.levelUp > 0 && <span className="reward-level">⭐ Level {reward.levelUp}!</span>}
                {session.winner !== me.id && <span className="reward-nudge">So close! Rematch and win it back 💪</span>}
              </span>
            )}
            <button type="button" className="primary-btn" onClick={() => playGame(def.id, opponents, session.convId.startsWith("dm:") ? session.convId : undefined)}>
              <RefreshCw size={16} /> Rematch
            </button>
          </div>
        )}
      </div>

      {celebrate && <Confetti />}

      {chatOpen && hasChat && (
        <div className="game-chat">
          <div className="game-chat-head">
            <strong>Chat</strong>
            <button type="button" className="round-btn round-btn--small" onClick={() => setChatOpen(false)} aria-label="Hide chat">
              <X size={15} />
            </button>
          </div>
          <ConversationView convId={session.convId} group={humans.length > 2} compact emptyTitle="Talk while you play" quickReplies={GAME_PHRASES} />
        </div>
      )}

      {itemsOpen && skinKindOf(def.id, def.felt) && (
        <Sheet title="Items · change your look" onClose={() => setItemsOpen(false)}>
          <SkinPicker kind={skinKindOf(def.id, def.felt)!} />
        </Sheet>
      )}

      {profile && (
        <PlayerProfileSheet playerId={profile} onClose={() => setProfile(null)} onChat={hasChat && profile !== me.id ? () => setChatOpen(true) : undefined} />
      )}
    </div>
  );
}
