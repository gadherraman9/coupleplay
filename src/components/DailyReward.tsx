import { useState } from "react";
import { Gift, Heart } from "lucide-react";
import { api } from "../backend/store";
import { useApp } from "../context";
import { DAILY_REWARDS, nextRewardIndex } from "../progress";
import { play } from "../games/sfx";
import { Confetti } from "../games/ui";

// The daily login calendar, shown once a day when the app opens.
export default function DailyReward({ onClose }: { onClose: () => void }) {
  const { me } = useApp();
  const today = nextRewardIndex(me);
  const [won, setWon] = useState<number | null>(null);

  const claim = () => {
    const result = api.claimDaily(me.id);
    setWon(result.hearts);
    play("reward");
    window.setTimeout(onClose, 2200);
  };

  return (
    <div className="sheet-backdrop daily-reward-backdrop" onClick={won !== null ? onClose : undefined}>
      <div className="daily-reward" role="dialog" aria-modal="true" aria-label="Daily reward" onClick={(e) => e.stopPropagation()}>
        <span className="daily-reward-icon">
          <Gift size={30} />
        </span>
        <h2>Daily reward</h2>
        <p>Come back every day — day 7 is a big one!</p>
        <div className="daily-calendar">
          {DAILY_REWARDS.map((hearts, i) => (
            <span key={i} className={`daily-day ${i < today ? "is-done" : ""} ${i === today ? "is-today" : ""} ${i === 6 ? "is-big" : ""} ${won !== null && i === today ? "is-claimed" : ""}`}>
              <small>Day {i + 1}</small>
              <b>{i === 6 ? "🎁" : <Heart size={16} fill="currentColor" />}</b>
              <em>+{hearts}</em>
            </span>
          ))}
        </div>
        {won === null ? (
          <button type="button" className="primary-btn is-ready" onClick={claim}>
            Claim +{DAILY_REWARDS[today]} hearts
          </button>
        ) : (
          <strong className="daily-won">+{won} hearts! See you tomorrow 💖</strong>
        )}
        {won === null && (
          <button type="button" className="text-link" onClick={onClose}>
            Later
          </button>
        )}
      </div>
      {won !== null && <Confetti burst={90} duration={2000} />}
    </div>
  );
}
