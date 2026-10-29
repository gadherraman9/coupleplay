import { avatarStyle } from "../data";
import { initialsOf, isOnline } from "../backend/store";
import { useApp } from "../context";

interface AvatarProps {
  initials: string;
  hue: number;
  size?: number;
  online?: boolean;
  className?: string;
}

export default function Avatar({ initials, hue, size = 44, online, className = "" }: AvatarProps) {
  return (
    <span
      className={`avatar ${className}`}
      style={{ ...avatarStyle(hue), width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
      {online && <span className="avatar-online" />}
    </span>
  );
}

export function UserAvatar({ id, size = 44, showOnline = true }: { id: string; size?: number; showOnline?: boolean }) {
  const { db, nameOf } = useApp();
  const user = db.users[id];
  const hue = user?.hue ?? (id.startsWith("ai:") ? 200 : 0);
  return (
    <Avatar
      initials={id.startsWith("ai:") ? "🤖" : initialsOf(nameOf(id))}
      hue={hue}
      size={size}
      online={showOnline && Boolean(user) && isOnline(db, id)}
    />
  );
}
