import { Check, Heart, Star, Target } from "lucide-react";
import { api } from "../backend/store";
import { useApp } from "../context";
import { levelProgress, MISSIONS, missionState } from "../progress";
import { play } from "../games/sfx";

// Level bar and today's missions on the home screen.
export default function Missions() {
  const { me, notify } = useApp();
  const level = levelProgress(me.xp);
  const state = missionState(me);

  return (
    <section className="card missions-card">
      <div className="level-row">
        <span className="level-badge">
          <Star size={14} fill="currentColor" /> Lv {level.level}
        </span>
        <span className="level-bar" aria-label={`${level.into} of ${level.need} XP to the next level`}>
          <i style={{ width: `${level.pct}%` }} />
        </span>
        <small>
          {level.into}/{level.need} XP
        </small>
      </div>
      <p className="level-meta">
        {me.wins ?? 0} wins{(me.winStreak ?? 0) > 1 ? ` · 🔥 ${me.winStreak} in a row` : ""} · win games to level up and unlock bonus hearts
      </p>
      <h3 className="missions-title">
        <Target size={16} /> Today's missions
      </h3>
      <div className="missions-list">
        {MISSIONS.map((mission) => {
          const count = Math.min(mission.goal, mission.count(state));
          const done = count >= mission.goal;
          const claimed = state.claimed.includes(mission.id);
          return (
            <div key={mission.id} className={`mission ${done ? "is-done" : ""} ${claimed ? "is-claimed" : ""}`}>
              <span className="mission-body">
                <b>{mission.title}</b>
                <span className="mission-bar">
                  <i style={{ width: `${(count / mission.goal) * 100}%` }} />
                </span>
              </span>
              {claimed ? (
                <span className="mission-claimed">
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : (
                <button
                  type="button"
                  className="mission-claim"
                  disabled={!done}
                  onClick={() => {
                    const hearts = api.claimMission(me.id, mission.id);
                    if (hearts) {
                      play("reward");
                      notify(`Mission done! +${hearts} hearts`);
                    }
                  }}
                >
                  {done ? "Claim" : `${count}/${mission.goal}`} <Heart size={11} fill="currentColor" /> {mission.reward}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
