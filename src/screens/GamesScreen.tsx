import { useState } from "react";
import { ChevronRight, Lock, Users } from "lucide-react";
import { GAMES } from "../data";
import type { GameId } from "../data";
import { GAME_ICONS } from "../gameIcons";
import { ONLINE_GAMES, gameById } from "../games/registry";
import { useApp } from "../context";
import { dailyDareState } from "../progress";

interface GamesScreenProps {
  onPickGame: (gameId: string) => void;
  onOpenParty: (game: GameId) => void;
}

const MOODS = [
  { id: "all", label: "All games", games: [] as string[] },
  { id: "chill", label: "Chill", games: ["rummy", "snakes", "dots", "bounce"] },
  { id: "competitive", label: "Competitive", games: ["chess", "callbreak", "pool", "poker", "checkers"] },
  { id: "quick", label: "Quick break", games: ["tictactoe", "fourinrow", "cards", "ludo", "tycoon"] },
];

export default function GamesScreen({ onPickGame, onOpenParty }: GamesScreenProps) {
  const { me } = useApp();
  const dare = dailyDareState(me);
  const featured = gameById(dare.gameId)!;
  const [mood, setMood] = useState(MOODS[0]);
  return (
    <div className="screen games-screen">
      <header className="page-header">
        <p className="eyebrow">Solo, with friends or strangers</p>
        <h1>Games</h1>
        <p className="page-sub">Chat while you play — tap the bubble inside any game.</p>
      </header>

      <section className={`daily-dare card ${dare.completed ? "is-complete" : ""}`} aria-label="Daily challenge">
        <div><p className="eyebrow">Today's challenge · resets at midnight UTC</p>
          <h3>{dare.completed ? "Challenge complete" : `Finish a game of ${featured.title}`}</h3>
          <p>+{dare.hearts} hearts · +{dare.xp} XP · {dare.streak}-day challenge streak</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => onPickGame(featured.id)}>{dare.completed ? "Play again" : "Take the challenge"}</button>
      </section>
      <div className="mood-picker" role="group" aria-label="Choose your mood">
        {MOODS.map(option => <button type="button" key={option.id} aria-pressed={mood.id === option.id} onClick={() => setMood(option)}>{option.label}</button>)}
      </div>
      <div className="game-grid">
        {ONLINE_GAMES.filter(game => mood.id === "all" || mood.games.includes(game.id)).map((game) => (
          <button key={game.id} type="button" className={`game-card ${game.className}`} onClick={() => onPickGame(game.id)}>
            <span className="game-card-icon game-card-emoji">{game.emoji}</span>
            <span className="game-card-body">
              <strong>{game.title}</strong>
              <small>{game.tagline}</small>
            </span>
            <span className="game-card-cta">
              {game.soloOnly ? "Solo" : game.minPlayers === game.maxPlayers ? (
                <>
                  <Users size={12} /> {game.minPlayers}
                </>
              ) : (
                <>
                  <Users size={12} /> {game.minPlayers}-{game.maxPlayers}
                </>
              )}
              <ChevronRight size={13} />
            </span>
          </button>
        ))}
      </div>

      <div className="section-head section-head--spaced">
        <h3>Couple games</h3>
      </div>
      <div className="game-grid">
        {GAMES.map((game) => {
          const Icon = GAME_ICONS[game.id];
          return (
            <button key={game.id} type="button" className={`game-card ${game.className}`} onClick={() => onOpenParty(game.id)}>
              <span className="game-card-icon">
                <Icon size={22} />
              </span>
              <span className="game-card-body">
                <strong>{game.title}</strong>
                <small>{game.tagline}</small>
              </span>
              <span className="game-card-cta">
                Play <ChevronRight size={13} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="games-note">
        <Lock size={13} /> Couple games are played together on one phone.
      </p>
    </div>
  );
}
