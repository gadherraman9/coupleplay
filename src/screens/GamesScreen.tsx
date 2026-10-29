import { ChevronRight, Lock } from "lucide-react";
import Avatar from "../components/Avatar";
import { GAMES } from "../data";
import type { GameId } from "../data";
import { GAME_ICONS } from "../gameIcons";

interface GamesScreenProps {
  onOpenGame: (game: GameId) => void;
}

export default function GamesScreen({ onOpenGame }: GamesScreenProps) {
  return (
    <div className="screen games-screen">
      <header className="page-header">
        <p className="eyebrow">Take a break together</p>
        <h1>Games</h1>
        <p className="page-sub">Pick a game and make tonight a little more fun.</p>
      </header>

      <button type="button" className="invite-banner" onClick={() => onOpenGame("truth")}>
        <span className="invite-avatar">
          <Avatar initials="P" hue={330} size={46} online />
        </span>
        <span className="invite-text">
          <small>Priya invites you</small>
          <strong>Let's play Truth or Dare</strong>
        </span>
        <span className="invite-join">Join</span>
      </button>

      <div className="game-grid">
        {GAMES.map((game) => {
          const Icon = GAME_ICONS[game.id];
          return (
            <button
              key={game.id}
              type="button"
              className={`game-card ${game.className}`}
              onClick={() => onOpenGame(game.id)}
            >
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
        <Lock size={13} /> Games are private to you and your partner.
      </p>
    </div>
  );
}
