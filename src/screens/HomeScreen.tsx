import { Bell, Check, ChevronRight, Flame, Heart, MessageCircle, Sparkles } from "lucide-react";
import Avatar from "../components/Avatar";
import Garden from "../components/Garden";
import { USER } from "../data";
import type { GameId } from "../data";

interface HomeScreenProps {
  dailyTaskDone: boolean;
  hearts: number;
  streak: number;
  onCompleteTask: () => void;
  onOpenGame: (game: GameId) => void;
  onOpenChat: (friendId: string) => void;
  onGoGames: () => void;
}

export default function HomeScreen({
  dailyTaskDone,
  hearts,
  streak,
  onCompleteTask,
  onOpenGame,
  onOpenChat,
  onGoGames,
}: HomeScreenProps) {
  const progress = Math.min(100, Math.round((hearts / 200) * 100));

  return (
    <div className="screen home-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">Good evening,</p>
          <h1 className="home-name">
            {USER.name}
            <span className="home-name-heart">
              <Heart size={17} fill="currentColor" />
            </span>
          </h1>
          <p className="home-sub">Keep the spark alive today.</p>
        </div>
        <div className="home-actions">
          <span className="icon-btn icon-btn--static" aria-hidden="true">
            <Bell size={19} />
            <span className="icon-dot" />
          </span>
          <Avatar initials={USER.initials} hue={USER.hue} size={46} online />
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
        <h2>Send a cute message to your partner</h2>
        <p>Complete today's challenge to earn hearts and keep the spark glowing.</p>
        <div className="daily-footer">
          <span className="streak-chip">
            <Flame size={15} fill="currentColor" /> {streak}-day streak
          </span>
          <button
            type="button"
            className={`complete-btn ${dailyTaskDone ? "is-done" : ""}`}
            onClick={onCompleteTask}
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

      <section className="card garden-card">
        <div className="garden-head">
          <div>
            <h3>Your Garden</h3>
            <p>Grown with every moment together</p>
          </div>
          <span className="level-chip">Level 3</span>
        </div>
        <Garden />
        <div className="garden-progress">
          <div className="progress-labels">
            <span>
              <Heart size={13} fill="currentColor" /> {hearts} / 200 hearts
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <span className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="garden-hint">Next bloom unlocks at 160 hearts</p>
        </div>
      </section>

      <section className="quick-section">
        <div className="section-head">
          <h3>Play together</h3>
          <button type="button" className="text-link" onClick={onGoGames}>
            See all
          </button>
        </div>
        <div className="quick-grid">
          <button type="button" className="quick-tile quick-tile--pink" onClick={() => onOpenGame("truth")}>
            <span className="quick-icon">
              <Heart size={18} fill="currentColor" />
            </span>
            <span className="quick-body">
              <strong>Truth or Dare</strong>
              <small>Take turns, get closer</small>
            </span>
            <ChevronRight size={17} className="quick-arrow" />
          </button>
          <button type="button" className="quick-tile" onClick={() => onOpenChat("priya")}>
            <span className="quick-icon quick-icon--lav">
              <MessageCircle size={18} />
            </span>
            <span className="quick-body">
              <strong>Say hi to Priya</strong>
              <small>She's online now</small>
            </span>
            <ChevronRight size={17} className="quick-arrow" />
          </button>
        </div>
      </section>
    </div>
  );
}
