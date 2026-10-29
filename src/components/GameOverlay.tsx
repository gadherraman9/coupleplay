import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Dices,
  Flame,
  Heart,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  DARES,
  DICE_CHALLENGES,
  GAMES,
  QUIZ,
  TRUTHS,
  WHEEL_OPTIONS,
} from "../data";
import type { GameId } from "../data";
import { GAME_ICONS } from "../gameIcons";

interface GameOverlayProps {
  gameId: GameId;
  partnerName: string;
  onClose: () => void;
}

function pickDifferent(pool: string[], current: string) {
  if (pool.length < 2) return pool[0];
  let next = current;
  while (next === current) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

function TruthGame({ partnerName }: { partnerName: string }) {
  const [mode, setMode] = useState<"truth" | "dare">("truth");
  const [prompt, setPrompt] = useState(
    () => TRUTHS[Math.floor(Math.random() * TRUTHS.length)],
  );

  const switchMode = (next: "truth" | "dare") => {
    if (next === mode) return;
    setMode(next);
    setPrompt(pickDifferent(next === "truth" ? TRUTHS : DARES, prompt));
  };

  const nextPrompt = () => {
    setPrompt((current) =>
      pickDifferent(mode === "truth" ? TRUTHS : DARES, current),
    );
  };

  return (
    <div className="truth-game">
      <div className="segmented" role="tablist" aria-label="Pick truth or dare">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "truth"}
          className={mode === "truth" ? "is-active" : ""}
          onClick={() => switchMode("truth")}
        >
          <Heart size={15} /> Truth
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "dare"}
          className={mode === "dare" ? "is-active" : ""}
          onClick={() => switchMode("dare")}
        >
          <Flame size={15} /> Dare
        </button>
      </div>

      <div className={`prompt-card prompt-card--${mode}`}>
        <span className="prompt-orb" aria-hidden="true" />
        <span className="prompt-orb prompt-orb--two" aria-hidden="true" />
        <span className="prompt-badge">
          {mode === "truth" ? <Heart size={13} /> : <Flame size={13} />}
          {mode === "truth" ? "Tell the truth" : "Accept the dare"}
        </span>
        <p className="prompt-text">{prompt}</p>
        <span className="prompt-foot">No skipping, no half answers</span>
      </div>

      <button type="button" className="primary-btn" onClick={nextPrompt}>
        <RefreshCw size={17} /> Another {mode}
      </button>

      <p className="game-hint">
        <Users size={15} /> Take turns — {partnerName} goes first.
      </p>
    </div>
  );
}

const DIE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const dots = DIE_DOTS[value] ?? [];
  return (
    <div className={`die ${rolling ? "is-rolling" : ""}`} aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`die-dot ${dots.includes(index) ? "is-on" : ""}`} />
      ))}
    </div>
  );
}

function DiceGame() {
  const [dice, setDice] = useState<[number, number]>([3, 6]);
  const [rolling, setRolling] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const rollDie = () => Math.floor(Math.random() * 6) + 1;

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setChallenge(null);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks += 1;
      setDice([rollDie(), rollDie()]);
      if (ticks >= 10) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        const first = rollDie();
        const second = rollDie();
        setDice([first, second]);
        setChallenge(DICE_CHALLENGES[first + second] ?? "Make up your own challenge!");
        setRolling(false);
      }
    }, 90);
  };

  return (
    <div className="dice-game">
      <div className="dice-stage">
        <Die value={dice[0]} rolling={rolling} />
        <Die value={dice[1]} rolling={rolling} />
      </div>

      <p className="dice-total">
        {rolling ? "Rolling..." : challenge ? `You rolled ${dice[0] + dice[1]}` : "Feeling lucky?"}
      </p>

      <button type="button" className="primary-btn" onClick={roll} disabled={rolling}>
        <Dices size={18} /> {rolling ? "Rolling..." : challenge ? "Roll again" : "Roll the dice"}
      </button>

      <div className={`challenge-card ${challenge ? "is-active" : ""}`}>
        <span className="challenge-icon">
          <Sparkles size={18} />
        </span>
        <p>{challenge ?? "Your challenge appears here after the first roll."}</p>
      </div>

      <p className="game-hint">
        <Users size={15} /> Rolled doubles? Make up a dare for each other.
      </p>
    </div>
  );
}

function QuizGame({ partnerName }: { partnerName: string }) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const question = QUIZ[step];
  const isLast = step === QUIZ.length - 1;

  const choose = (index: number) => {
    if (chosen !== null) return;
    setChosen(index);
    if (index === question.answer) setScore((value) => value + 1);
  };

  const next = () => {
    if (chosen === null) return;
    if (isLast) {
      setDone(true);
      return;
    }
    setStep((value) => value + 1);
    setChosen(null);
  };

  const restart = () => {
    setStep(0);
    setChosen(null);
    setScore(0);
    setDone(false);
  };

  if (done) {
    const title =
      score === QUIZ.length
        ? "Soulmate energy!"
        : score >= 2
          ? "Pretty well in sync!"
          : "More date nights needed!";
    return (
      <div className="quiz-result">
        <span className="result-icon">
          <Trophy size={30} />
        </span>
        <h3>{title}</h3>
        <p className="quiz-score">
          {score} / {QUIZ.length}
        </p>
        <p className="result-copy">
          {score === QUIZ.length
            ? `You know ${partnerName} by heart. Genuinely impressive.`
            : `There's always more to discover about ${partnerName}. Keep playing together.`}
        </p>
        <button type="button" className="primary-btn" onClick={restart}>
          <RefreshCw size={17} /> Play again
        </button>
      </div>
    );
  }

  return (
    <div className="quiz-game">
      <div className="quiz-progress">
        {QUIZ.map((item, index) => (
          <span
            key={item.question}
            className={`quiz-dot ${index < step ? "is-done" : ""} ${index === step ? "is-current" : ""}`}
          />
        ))}
        <span className="quiz-counter">
          {step + 1} of {QUIZ.length}
        </span>
      </div>

      <div className="quiz-card">
        <span className="quiz-kicker">How well do you know {partnerName}?</span>
        <h3>{question.question}</h3>
        <div className="quiz-options">
          {question.options.map((option, index) => {
            const state =
              chosen === null
                ? ""
                : index === question.answer
                  ? "is-correct"
                  : chosen === index
                    ? "is-wrong"
                    : "is-dimmed";
            return (
              <button
                key={option}
                type="button"
                className={`quiz-option ${state}`}
                onClick={() => choose(index)}
                disabled={chosen !== null}
              >
                <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                {option}
              </button>
            );
          })}
        </div>
        {chosen !== null && (
          <p className={`quiz-reveal ${chosen === question.answer ? "is-correct" : "is-wrong"}`}>
            {chosen === question.answer
              ? `Nailed it — that's ${partnerName}'s pick!`
              : `Not quite. ${partnerName}'s pick is "${question.options[question.answer]}".`}
          </p>
        )}
      </div>

      <button type="button" className="primary-btn" onClick={next} disabled={chosen === null}>
        {isLast ? "See my score" : "Next question"} <ChevronRight size={17} />
      </button>
    </div>
  );
}

function WheelGame() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const index = Math.floor(Math.random() * WHEEL_OPTIONS.length);
    const base = rotation - (rotation % 360);
    const target = base + 360 * 5 + (360 - (index * 60 + 30));
    setRotation(target);
    timer.current = setTimeout(() => {
      setResult(WHEEL_OPTIONS[index].label);
      setSpinning(false);
      timer.current = null;
    }, 3300);
  };

  return (
    <div className="wheel-game">
      <div className="wheel-stage">
        <span className="wheel-pointer" aria-hidden="true" />
        <div
          className="wheel"
          style={{ transform: `rotate(${rotation}deg)` }}
          role="img"
          aria-label="Date night wheel with six date ideas"
        >
          {WHEEL_OPTIONS.map((option, index) => {
            const angle = index * 60 + 30;
            const onScreen = (angle + rotation) % 360;
            const flipped = onScreen > 90 && onScreen < 270;
            return (
              <span
                key={option.label}
                className={`wheel-label ${option.className}`}
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <span
                  style={{
                    transform: `translateX(-50%)${flipped ? " rotate(180deg)" : ""}`,
                  }}
                >
                  {option.label}
                </span>
              </span>
            );
          })}
        </div>
        <span className="wheel-hub" aria-hidden="true">
          <Heart size={22} fill="currentColor" />
        </span>
      </div>

      <div className={`wheel-result ${result ? "is-active" : ""}`}>
        {result ? (
          <>
            Tonight's pick
            <strong>{result}</strong>
          </>
        ) : (
          <span>Let the wheel plan your next date night.</span>
        )}
      </div>

      <button type="button" className="primary-btn" onClick={spin} disabled={spinning}>
        <Sparkles size={17} /> {spinning ? "Spinning..." : "Spin the wheel"}
      </button>

      <p className="game-hint">
        <Users size={15} /> Whatever it lands on, no take-backs.
      </p>
    </div>
  );
}

export default function GameOverlay({ gameId, partnerName, onClose }: GameOverlayProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const game = GAMES.find((item) => item.id === gameId);
  if (!game) return null;
  const Icon = GAME_ICONS[game.id];

  return (
    <div className="game-overlay" role="dialog" aria-modal="true" aria-label={game.title}>
      <header className="game-topbar">
        <button type="button" className="round-btn" onClick={onClose} aria-label="Close game">
          <X size={19} />
        </button>
        <div className="game-topbar-title">
          <h2>{game.title}</h2>
          <p>Playing with {partnerName}</p>
        </div>
        <span className={`game-topbar-icon game-topbar-icon--${game.id}`}>
          <Icon size={18} />
        </span>
      </header>

      <div className="game-body">
        {gameId === "truth" && <TruthGame partnerName={partnerName} />}
        {gameId === "dice" && <DiceGame />}
        {gameId === "quiz" && <QuizGame partnerName={partnerName} />}
        {gameId === "wheel" && <WheelGame />}
      </div>
    </div>
  );
}
