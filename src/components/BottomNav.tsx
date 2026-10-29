import { Gamepad2, Home, MessageCircle, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tab } from "../data";

interface BottomNavProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "friends", label: "Friends", icon: Users },
];

export default function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            className={`nav-item ${active ? "is-active" : ""}`}
            onClick={() => onChange(id)}
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon">
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            </span>
            <span className="nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
