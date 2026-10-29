import { ChevronRight, Lock, Users } from "lucide-react";
import { GAMES } from "../data";
import type { GameId } from "../data";
import { GAME_ICONS } from "../gameIcons";
import { ONLINE_GAMES } from "../games/registry";

interface GamesScreenProps {
  onPickGame: (gameId: string) => void;
  onOpenParty: (game: GameId) => void;
}

export default function GamesScreen({ onPickGame, onOpenParty }: GamesScreenProps) {
  return (
    <div className="screen games-screen">
      <header className="page-header">
        <p className="eyebrow">Solo, with friends or strangers</p>
        <h1>Games</h1>
        <p className="page-sub">Chat while you play — tap the bubble inside any game.</p>
      </header>

      <div className="game-grid">
        {ONLINE_GAMES.map((game) => (
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
