import { avatarStyle } from "../data";

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
