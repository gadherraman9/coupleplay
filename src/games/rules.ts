// "How to play" text for each game's page.
export const RULES: Record<string, { title: string; text: string }[]> = {
  ludo: [
    { title: "Goal", text: "Bring all four of your pieces from your base to the home triangle in the middle." },
    { title: "Starting", text: "Roll a 6 to move a piece out of base onto your start square." },
    { title: "Moving", text: "Move one piece by the number you roll. A 6, a capture or reaching home gives you an extra roll." },
    { title: "Capturing", text: "Land on an opponent's piece to send it back to its base. Star squares and start squares are safe." },
    { title: "Home", text: "You need the exact number to enter the home triangle." },
  ],
  snakes: [
    { title: "Goal", text: "Be the first to reach square 100." },
    { title: "Moving", text: "Roll and move forward. A 6 gives you another turn." },
    { title: "Ladders and snakes", text: "Land at the foot of a ladder to climb up; land on a snake's head to slide down to its tail." },
    { title: "Finish", text: "You need the exact roll to land on 100." },
  ],
  cards: [
    { title: "Goal", text: "Be the first to play every card in your hand." },
    { title: "Playing", text: "Match the top card by colour or number, or play a wild card on anything." },
    { title: "Drawing", text: "If you can't (or don't want to) play, draw a card. You may play it or pass." },
    { title: "Action cards", text: "Skip (⊘) skips the next player, Reverse (⇄) changes direction, +2 and +4 make the next player draw and lose their turn." },
    { title: "Wild cards", text: "★ lets you pick the next colour; +4 also makes the next player draw four." },
  ],
  poker: [
    { title: "Goal", text: "Win every chip, or have the most chips after the last hand." },
    { title: "The deal", text: "Everyone gets two private cards. Up to five shared cards are dealt face up in the middle." },
    { title: "Betting", text: "Each round you can fold, check, call or raise. Blinds go up every 5 hands." },
    { title: "Hands", text: "Best five cards win: high card < pair < two pair < three of a kind < straight < flush < full house < four of a kind < straight flush." },
    { title: "All-in", text: "If you run short you can still go all-in; side pots are worked out for you." },
  ],
  callbreak: [
    { title: "Goal", text: "Score the most points after 5 rounds." },
    { title: "Bidding", text: "Look at your 13 cards and call how many tricks you will win (1 to 8)." },
    { title: "Tricks", text: "Follow the suit that was led and beat it if you can. If you can't follow, you must play a spade (trump)." },
    { title: "Scoring", text: "Make your call: score the call plus 0.1 for each extra trick. Miss it: lose your call." },
  ],
  rummy: [
    { title: "Goal", text: "Arrange all 13 cards into sequences and sets, then declare." },
    { title: "Turn", text: "Draw from the deck or take the open card, then discard one card." },
    { title: "Valid show", text: "You need at least two sequences, and one of them must be pure (no jokers). The rest can be sets or sequences." },
    { title: "Jokers", text: "Printed jokers and every card of the wild rank can stand in for any card." },
    { title: "Points", text: "Other players score the points of their unmatched cards (max 80). Lowest total after 3 deals wins." },
  ],
  pool: [
    { title: "Goal", text: "Pocket your solids or stripes, then pocket the black on a later shot." },
    { title: "Aim", text: "Tap or drag on the table, adjust power, then Shoot. Arrow keys fine-tune aim and power." },
    { title: "Fouls", text: "Scratching, hitting the wrong ball first, missing all balls, or making no pocket/cushion contact after a hit gives the opponent ball in hand." },
    { title: "Ball in hand", text: "Place the cue on a clear spot and confirm. Potting black too early or with a foul loses the game." },
  ],
  chess: [
    { title: "Goal", text: "Checkmate the other king: attack it so it has no safe move." },
    { title: "Moves", text: "Tap a piece to see where it can go, then tap a highlighted square." },
    { title: "Special moves", text: "Castling, en passant and pawn promotion are all supported." },
    { title: "Draws", text: "Claim after threefold repetition or 50 moves by each player without a pawn move or capture. Fivefold repetition, 75 moves, stalemate and dead positions draw automatically. Use Rematch to play again." },
  ],
};

export const GENERIC_RULES = [{ title: "How to play", text: "Take turns, follow the hints on screen and have fun together!" }];
