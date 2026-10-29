import { useEffect } from "react";
import { BOT_REPLIES, ROOM_BOT_LINES } from "./seed";
import { api, otherInDm } from "./store";
import type { DB } from "./types";

const handled = new Set<string>();
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

// Runs in the tab of the person who talked to a bot, so replies are sent once.
export function useBotBrain(db: DB, me: string | null) {
  useEffect(() => {
    if (!me) return;
    // Timers are not cancelled on re-render: the database changes often and
    // a pending reply should still arrive.
    const later = (key: string, delay: number, fn: () => void) => {
      if (handled.has(key)) return;
      handled.add(key);
      window.setTimeout(() => {
        try {
          fn();
        } catch {
          /* the chat may have closed meanwhile */
        }
      }, delay);
    };

    for (const request of db.requests) {
      if (request.from === me && db.users[request.to]?.isBot) {
        later(`req:${request.id}`, 1500, () => api.acceptRequest(request.id));
      }
    }

    const lastByConv = new Map<string, (typeof db.messages)[number]>();
    for (const message of db.messages) lastByConv.set(message.convId, message);

    for (const [convId, last] of lastByConv) {
      if (last.from !== me || last.kind === "system") continue;
      if (convId.startsWith("dm:")) {
        const other = otherInDm(convId, me);
        if (!db.users[other]?.isBot) continue;
        const reply =
          last.kind === "image"
            ? "Wow, nice pic! 😍"
            : last.kind === "voice"
              ? "Your voice note made me smile 🥰"
              : last.kind === "invite"
                ? "Joining in a sec! 🎮"
                : pick(BOT_REPLIES);
        later(`msg:${last.id}`, 1300 + Math.random() * 900, () =>
          api.sendMessage(other, convId, { kind: "text", text: reply }),
        );
      } else if (convId.startsWith("str:")) {
        const chat = db.strangers.find((c) => `str:${c.id}` === convId);
        if (!chat?.open) continue;
        const other = chat.a === me ? chat.b : chat.a;
        if (!db.users[other]?.isBot) continue;
        later(`msg:${last.id}`, 1500 + Math.random() * 1200, () =>
          api.sendMessage(other, convId, { kind: "text", text: pick(BOT_REPLIES) }),
        );
      } else if (convId.startsWith("room:") && Math.random() < 0.5) {
        const roomId = convId.slice(5);
        const lines = ROOM_BOT_LINES[roomId] ?? BOT_REPLIES;
        const botIds = Object.values(db.users).filter((u) => u.isBot).map((u) => u.id);
        later(`msg:${last.id}`, 2200 + Math.random() * 2500, () =>
          api.sendMessage(pick(botIds), convId, { kind: "text", text: pick(lines) }),
        );
      } else {
        handled.add(`msg:${last.id}`);
      }
    }
  }, [db, me]);
}
