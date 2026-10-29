import { Check, ChevronRight, Flame, Heart, MessageCircle, Palette, Shuffle, Sparkles, UsersRound } from "lucide-react";
import { UserAvatar } from "../components/Avatar";
import Garden from "../components/Garden";
import { api, dmId, todayKey } from "../backend/store";
import { useApp } from "../context";
import { ONLINE_GAMES } from "../games/registry";

interface HomeScreenProps {
  onGoGames: () => void;
  onOpenStrangers: () => void;
  onOpenRooms: () => void;
  onOpenShop: () => void;
  onPickGame: (gameId: string) => void;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
}

export default function HomeScreen({ onGoGames, onOpenStrangers, onOpenRooms, onOpenShop, onPickGame }: HomeScreenProps) {
  const { me, notify, openChat, nameOf } = useApp();
  const dailyTaskDone = me.lastDailyTask === todayKey();
  const level = Math.floor(me.hearts / 200) + 1;
  const progress = Math.round(((me.hearts % 200) / 200) * 100);

  const completeTask = () => {
    if (api.completeDailyTask(me.id)) notify("Daily task complete — +10 hearts");
  };

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 className="home-name">
            {me.displayName}
            <span className="home-name-heart">
              <Heart size={17} fill="currentColor" />
            </span>
          </h1>
          <p className="home-sub">{me.isGuest ? "Playing as guest" : `@${me.username}`}</p>
        </div>
        <div className="home-actions">
          <button type="button" className="hearts-pill" onClick={onOpenShop} aria-label="Open theme shop">
            <Heart size={14} fill="currentColor" /> {me.hearts}
          </button>
          <UserAvatar id={me.id} size={46} />
        </div>
      </header>

      <section className="card daily-card">
        <span className="daily-watermark" aria-hidden="true">
          <Heart size={150} fill="currentColor" />
        </span>
        <div className="daily-top">
          <span className="pill pill--glass">
            <Sparkles size={12} /> Daily task
          </span>
          <span className="daily-reward">
            <Heart size={13} fill="currentColor" /> +10
          </span>
        </div>
        <h2>{me.partnerId ? `Send a cute message to ${nameOf(me.partnerId)}` : "Say something nice to a friend"}</h2>
        <p>Complete today's challenge to earn hearts and keep your streak going.</p>
        <div className="daily-footer">
          <span className="streak-chip">
            <Flame size={15} fill="currentColor" /> {me.streak}-day streak
          </span>
          <button
            type="button"
            className={`complete-btn ${dailyTaskDone ? "is-done" : ""}`}
            onClick={completeTask}
            disabled={dailyTaskDone}
          >
            {dailyTaskDone ? (
              <>
                <Check size={15} strokeWidth={3} /> Completed
              </>
            ) : (
              "Complete"
            )}
          </button>
        </div>
      </section>

      <section className="quick-section">
        <div className="quick-grid">
          <button type="button" className="quick-tile quick-tile--pink" onClick={onOpenStrangers}>
            <span className="quick-icon">
              <Shuffle size={18} />
            </span>
            <span className="quick-body">
              <strong>Talk to a stranger</strong>
              <small>Random 1-on-1 chat</small>
            </span>
            <ChevronRight size={17} className="quick-arrow" />
          </button>
          <button type="button" className="quick-tile" onClick={onOpenRooms}>
            <span className="quick-icon quick-icon--lav">
              <UsersRound size={18} />
            </span>
            <span className="quick-body">
              <strong>Chat rooms</strong>
              <small>Join a group conversation</small>
            </span>
            <ChevronRight size={17} className="quick-arrow" />
          </button>
          {me.partnerId && (
            <button type="button" className="quick-tile" onClick={() => openChat(dmId(me.id, me.partnerId!))}>
              <span className="quick-icon quick-icon--lav">
                <MessageCircle size={18} />
              </span>
              <span className="quick-body">
                <strong>Say hi to {nameOf(me.partnerId)}</strong>
                <small>Your partner</small>
              </span>
              <ChevronRight size={17} className="quick-arrow" />
            </button>
          )}
          <button type="button" className="quick-tile" onClick={onOpenShop}>
            <span className="quick-icon quick-icon--lav">
              <Palette size={18} />
            </span>
            <span className="quick-body">
              <strong>Theme shop</strong>
              <small>Spend hearts on new looks</small>
            </span>
            <ChevronRight size={17} className="quick-arrow" />
          </button>
        </div>
      </section>

      <section className="quick-section">
        <div className="section-head">
          <h3>Play now</h3>
          <button type="button" className="text-link" onClick={onGoGames}>
            See all
          </button>
        </div>
        <div className="mini-games">
          {ONLINE_GAMES.map((game) => (
            <button key={game.id} type="button" className={`mini-game ${game.className}`} onClick={() => onPickGame(game.id)}>
              <span>{game.emoji}</span>
              <small>{game.title}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card garden-card">
        <div className="garden-head">
          <div>
            <h3>Your Garden</h3>
            <p>Grows with every heart you earn</p>
          </div>
          <span className="level-chip">Level {level}</span>
        </div>
        <Garden />
        <div className="garden-progress">
          <div className="progress-labels">
            <span>
              <Heart size={13} fill="currentColor" /> {me.hearts % 200} / 200 to next level
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <span className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="garden-hint">Win games (+20) and finish daily tasks (+10) to earn hearts.</p>
        </div>
      </section>
    </div>
  );
}
