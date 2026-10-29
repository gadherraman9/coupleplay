import type { Room, User } from "./types";

function bot(id: string, displayName: string, hue: number): User {
  return {
    id,
    username: displayName.toLowerCase(),
    displayName,
    hue,
    isGuest: false,
    isBot: true,
    hearts: 0,
    streak: 0,
    ownedThemes: [],
    appTheme: "rose",
    chatTheme: "classic",
    createdAt: 0,
  };
}

// Demo friends that answer automatically, so the app is fun even when
// nobody else is online. They are clearly marked as bots in the UI.
export const BOT_USERS: User[] = [
  bot("bot-priya", "Priya", 330),
  bot("bot-rahul", "Rahul", 215),
  bot("bot-meera", "Meera", 20),
  bot("bot-arjun", "Arjun", 160),
  bot("bot-riya", "Riya", 275),
];

export const ROOMS: Room[] = [
  { id: "lounge", name: "Couples Lounge", emoji: "💞", topic: "Date ideas, love stories and advice" },
  { id: "gamers", name: "Game Night", emoji: "🎮", topic: "Find people to play Ludo, cards and pool" },
  { id: "music", name: "Music & Vibes", emoji: "🎧", topic: "Share songs that remind you of someone" },
  { id: "desi", name: "Desi Adda", emoji: "☕", topic: "Hindi, Hinglish, chai and gossip" },
  { id: "night", name: "Late Night Talks", emoji: "🌙", topic: "Can't sleep? Talk it out here" },
];

export const BOT_REPLIES = [
  "Haha that's so cute 😄",
  "Aww, you just made my day.",
  "Same here! Miss you already.",
  "Okay now I'm smiling at my phone like a fool 🙈",
  "Let's play a game tonight?",
  "Tell me more!",
  "Hahaha seriously? 😂",
  "Ludo khelein? I'll win this time 😤",
];

export const ROOM_BOT_LINES: Record<string, string[]> = {
  lounge: ["Best first date idea? I vote sunset picnic 🌅", "Long distance couples, how do you stay close?", "Cooking together is underrated honestly"],
  gamers: ["Anyone up for Ludo? 🎲", "Pool rematch anyone?", "Color Cards is chaos and I love it"],
  music: ["Arijit at 2am hits different 🎶", "Drop your current favourite song!", "Lo-fi + rain = perfect"],
  desi: ["Chai ya coffee? ☕", "Kya scene hai aaj ka?", "Bhai Monday phir aa gaya 😩"],
  night: ["Can't sleep either?", "Night thoughts are the most honest ones", "Stars look amazing tonight ✨"],
};
