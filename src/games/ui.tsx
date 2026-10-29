const DIE_DOTS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ value, small }: { value: number | null; small?: boolean }) {
  const dots = value ? DIE_DOTS[value] : [];
  return (
    <div
      key={value ?? 0}
      className={`die ${small ? "die--small" : ""} ${value ? "is-landed" : ""}`}
      aria-label={value ? `Die showing ${value}` : "Die not rolled yet"}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`die-dot ${dots.includes(index) ? "is-on" : ""}`} />
      ))}
    </div>
  );
}

// Game logs are stored as "playerId|text" (and "@[playerId]" inside the text)
// so each client shows its own names.
export function LogLine({ log, names }: { log: string; names: Record<string, string> }) {
  const withNames = (text: string) => text.replace(/@\[([^\]]+)\]/g, (_, id: string) => names[id] ?? "someone");
  const split = log.indexOf("|");
  if (split < 0) return <p className="game-log">{withNames(log)}</p>;
  const who = log.slice(0, split);
  return (
    <p className="game-log">
      <strong>{names[who] ?? "Someone"}</strong> {withNames(log.slice(split + 1))}
    </p>
  );
}
