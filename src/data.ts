export type Tab = "home" | "games" | "chats" | "friends";

export type GameId = "truth" | "dice" | "quiz" | "wheel";

export interface Friend {
  id: string;
  name: string;
  initials: string;
  hue: number;
  online?: boolean;
  partner?: boolean;
}

export interface Message {
  id: number;
  from: "me" | "them";
  text?: string;
  time: string;
  invite?: { game: GameId; title: string; subtitle: string };
}

export interface Conversation {
  friendId: string;
  messages: Message[];
}

export interface FriendRequest {
  id: string;
  name: string;
  initials: string;
  hue: number;
  mutual: number;
}

export interface GameCard {
  id: GameId;
  title: string;
  tagline: string;
  className: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}

export const FRIENDS: Friend[] = [
  { id: "priya", name: "Priya", initials: "P", hue: 330, online: true, partner: true },
  { id: "rahul", name: "Rahul", initials: "R", hue: 215, online: true },
  { id: "riya", name: "Riya", initials: "R", hue: 275 },
  { id: "meera", name: "Meera", initials: "M", hue: 20, online: true },
  { id: "arjun", name: "Arjun", initials: "A", hue: 160 },
];

export const USER = { name: "Alex", initials: "A", hue: 285 };

export const INITIAL_REQUESTS: FriendRequest[] = [
  { id: "ananya", name: "Ananya", initials: "A", hue: 195, mutual: 4 },
  { id: "kabir", name: "Kabir", initials: "K", hue: 40, mutual: 2 },
];

export const GAMES: GameCard[] = [
  {
    id: "truth",
    title: "Truth or Dare",
    tagline: "Spice it up with fun questions and dares.",
    className: "game-card--truth",
  },
  {
    id: "dice",
    title: "Dice Challenge",
    tagline: "Roll the dice and complete fun challenges together.",
    className: "game-card--dice",
  },
  {
    id: "quiz",
    title: "Couple Quiz",
    tagline: "Test how well you know each other.",
    className: "game-card--quiz",
  },
  {
    id: "wheel",
    title: "Date Night Wheel",
    tagline: "Random romantic and fun activities.",
    className: "game-card--wheel",
  },
];

export const TRUTHS = [
  "Describe your partner in three words — no thinking twice.",
  "What was the exact moment you knew you liked them?",
  "What's your favorite memory of the two of you?",
  "What's something small they do that always makes you smile?",
  "Who said \"I love you\" first — and how did it happen?",
  "What's one thing still on your couple bucket list?",
  "Which song instantly reminds you of your partner?",
  "What's the most romantic thing anyone has ever done for you?",
  "What's a habit of theirs you secretly find adorable?",
  "If you could relive one date together, which would it be?",
];

export const DARES = [
  "Give your partner a 10-second shoulder massage.",
  "Send a no-filter selfie right now.",
  "Do your best impression of your partner.",
  "Finish this line out loud: \"The thing I love most about you is...\"",
  "Hold eye contact for 20 seconds without laughing.",
  "Write a two-line poem about your partner on the spot.",
  "Let your partner pick your next profile picture.",
  "Serenade them with 15 seconds of any love song.",
  "Text a friend telling them how happy your partner makes you.",
  "Recreate your partner's favorite dance move.",
];

export const DICE_CHALLENGES: Record<number, string> = {
  2: "Double trouble — you both do one dare of your partner's choice.",
  3: "Whisper a compliment that starts with \"I secretly love...\"",
  4: "Share something you've never told them about your first impression.",
  5: "Give a compliment you've never said out loud before.",
  6: "Mirror pose: copy each other's moves for 30 seconds.",
  7: "Lucky seven! Pick a dare and hand it to your partner.",
  8: "Send a voice note saying something sweet — right now.",
  9: "Slow dance together for one whole minute.",
  10: "Plan a surprise date; your partner picks the budget.",
  11: "Tell the full story of your favorite date together.",
  12: "Jackpot! You're planning a whole date night this weekend.",
};

export const QUIZ: QuizQuestion[] = [
  {
    question: "What's Priya's idea of a perfect date?",
    options: ["Sunset picnic", "Arcade night", "Museum tour", "Movie marathon"],
    answer: 0,
  },
  {
    question: "Which little thing always makes Priya smile?",
    options: ["Morning texts", "Inside jokes", "Surprise snacks", "Slow songs"],
    answer: 1,
  },
  {
    question: "Priya's favorite game in CouplePlay?",
    options: ["Dice Challenge", "Truth or Dare", "Couple Quiz", "Date Night Wheel"],
    answer: 1,
  },
  {
    question: "Her go-to weekend plan?",
    options: ["Sleep in till noon", "Shopping spree", "Long walk + coffee", "Gaming all day"],
    answer: 2,
  },
];

export const WHEEL_OPTIONS = [
  { label: "Sunset picnic", className: "seg-0" },
  { label: "Movie night", className: "seg-1" },
  { label: "Cook together", className: "seg-2" },
  { label: "Game night", className: "seg-3" },
  { label: "Long drive", className: "seg-4" },
  { label: "Stargazing", className: "seg-5" },
];

export const REPLY_POOL = [
  "That's so sweet of you!",
  "Aww, you just made my day.",
  "Same here! Miss you already.",
  "You always know what to say.",
  "Okay, now I'm smiling at my phone like a fool.",
  "Let's do something fun tonight?",
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    friendId: "priya",
    messages: [
      { id: 1, from: "them", text: "Hey you! How's the day going?", time: "8:02 PM" },
      { id: 2, from: "me", text: "Better now that you're here.", time: "8:03 PM" },
      {
        id: 3,
        from: "them",
        text: "Smooth. Okay, I have a challenge for us.",
        time: "8:04 PM",
      },
      {
        id: 4,
        from: "them",
        time: "8:05 PM",
        invite: {
          game: "truth",
          title: "Truth or Dare",
          subtitle: "Let's play Truth or Dare!",
        },
      },
    ],
  },
  {
    friendId: "rahul",
    messages: [
      { id: 1, from: "them", text: "Bro, the new dice game is actually fun.", time: "6:40 PM" },
      { id: 2, from: "me", text: "Told you. Rematch later?", time: "6:44 PM" },
    ],
  },
  {
    friendId: "meera",
    messages: [
      { id: 1, from: "them", text: "Ananya says hi! Join us for a quiz?", time: "4:12 PM" },
    ],
  },
];

export const CONVERSATION_TIMES: Record<string, string> = {
  priya: "8:05 PM",
  rahul: "6:44 PM",
  meera: "4:12 PM",
};

export function avatarStyle(hue: number) {
  return {
    background: `linear-gradient(140deg, hsl(${hue} 88% 76%), hsl(${hue + 32} 78% 60%))`,
  };
}

export function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
