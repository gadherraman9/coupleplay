import { CircleUserRound, Gamepad2, Heart, Home, MessageCircle, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tab = "home" | "games" | "chats" | "friends" | "me";

interface BottomNavProps {
  tab: Tab | null;
  onChange: (tab: Tab) => void;
  badges?: Partial<Record<Tab, number>>;
  hiddenOnMobile?: boolean;
}

const ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "friends", label: "Friends", icon: Users },
  { id: "me", label: "Me", icon: CircleUserRound },
];

// A bottom bar on phones, a sidebar on wider screens.
export default function BottomNav({ tab, onChange, badges = {}, hiddenOnMobile }: BottomNavProps) {
  return (
    <nav className={`bottom-nav ${hiddenOnMobile ? "is-hidden-mobile" : ""}`} aria-label="Primary">
      <span className="nav-brand" aria-hidden="true">
        <Heart size={20} fill="currentColor" />
        <span>
          Couple<b>Play</b>
        </span>
      </span>
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        const badge = badges[id] ?? 0;
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
              {badge > 0 && <span className="badge nav-badge">{badge > 9 ? "9+" : badge}</span>}
            </span>
            <span className="nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
