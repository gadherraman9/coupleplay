import { useEffect, useState } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { nowTime } from "../data";

interface StatusBarProps {
  light?: boolean;
}

export default function StatusBar({ light = false }: StatusBarProps) {
  const [time, setTime] = useState(nowTime());

  useEffect(() => {
    const id = window.setInterval(() => setTime(nowTime()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`status-bar ${light ? "status-bar--light" : ""}`} aria-hidden="true">
      <span className="status-time">{time}</span>
      <span className="status-icons">
        <Signal size={15} strokeWidth={2.6} />
        <Wifi size={15} strokeWidth={2.6} />
        <BatteryFull size={21} strokeWidth={2.2} />
      </span>
    </div>
  );
}
