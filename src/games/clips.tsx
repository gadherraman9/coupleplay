// Short video clips made with Google Flow (public/media). They play as
// overlays at key moments; a tap skips them and a stuck video never blocks.
import { useEffect, useRef } from "react";
import { isMuted } from "./sfx";

export type ClipName = "gun" | "axe" | "win" | "dice" | "intro";

const base = import.meta.env.BASE_URL;
// Phones get the 720p file, big screens the 1080p one.
const hd = typeof window !== "undefined" && window.innerWidth >= 900 && window.innerWidth * (window.devicePixelRatio || 1) >= 1400;
export const clipSrc = (name: ClipName) => `${base}media/${name}-${hd ? 1080 : 720}.mp4`;
export const clipPoster = (name: ClipName) => `${base}media/${name}.jpg`;

// Warms the browser cache so the clip starts instantly when needed.
export function preloadClip(name: ClipName) {
  if (typeof document === "undefined") return;
  const id = `clip-preload-${name}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "preload";
  link.as = "video";
  link.href = clipSrc(name);
  document.head.appendChild(link);
}

export function ClipPlayer({
  name,
  onEnd,
  className = "",
  sound = false,
  rate = 1,
  maxMs = 5000,
  hold = false,
}: {
  name: ClipName;
  onEnd?: () => void;
  className?: string;
  sound?: boolean;
  rate?: number;
  maxMs?: number;
  // Keep showing the last frame instead of calling onEnd.
  hold?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const finish = () => {
    if (done.current) return;
    done.current = true;
    endRef.current?.();
  };

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.playbackRate = rate;
    video.muted = !sound || isMuted();
    video.play().catch(() => {
      // Autoplay with sound refused: try silently, else give up.
      video.muted = true;
      video.play().catch(() => !hold && finish());
    });
    const timer = hold ? 0 : window.setTimeout(finish, maxMs);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <video
      ref={ref}
      className={`clip ${className}`}
      src={clipSrc(name)}
      poster={clipPoster(name)}
      playsInline
      preload="auto"
      onEnded={() => !hold && finish()}
      onError={() => !hold && finish()}
      onClick={(e) => {
        e.stopPropagation();
        if (!hold) finish();
      }}
    />
  );
}
