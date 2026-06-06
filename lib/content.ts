// Starter content. Add more entries freely — the game picks at random.

export interface WordEntry {
  word: string;
  // A decoy that's adjacent to the word but is NEVER the word itself.
  imposterHint: string;
}

export const WORDS: WordEntry[] = [
  { word: "beach", imposterHint: "summer" },
  { word: "hospital", imposterHint: "doctor" },
  { word: "wedding", imposterHint: "party" },
  { word: "airport", imposterHint: "vacation" },
  { word: "gym", imposterHint: "healthy" },
  { word: "library", imposterHint: "quiet" },
  { word: "school", imposterHint: "homework" },
  { word: "restaurant", imposterHint: "dinner" },
  { word: "zoo", imposterHint: "animals" },
  { word: "cinema", imposterHint: "popcorn" },
  { word: "supermarket", imposterHint: "groceries" },
  { word: "park", imposterHint: "outdoors" },
  { word: "office", imposterHint: "meeting" },
  { word: "kitchen", imposterHint: "cooking" },
  { word: "bedroom", imposterHint: "sleep" },
  { word: "bathroom", imposterHint: "shower" },
  { word: "garden", imposterHint: "plants" },
  { word: "farm", imposterHint: "tractor" },
  { word: "mountain", imposterHint: "hiking" },
  { word: "desert", imposterHint: "hot" },
  { word: "forest", imposterHint: "trees" },
  { word: "ocean", imposterHint: "waves" },
  { word: "snow", imposterHint: "winter" },
  { word: "rain", imposterHint: "umbrella" },
  { word: "birthday", imposterHint: "cake" },
  { word: "concert", imposterHint: "music" },
  { word: "museum", imposterHint: "history" },
  { word: "casino", imposterHint: "gambling" },
  { word: "bank", imposterHint: "money" },
  { word: "pharmacy", imposterHint: "medicine" },
  { word: "dentist", imposterHint: "teeth" },
  { word: "barber", imposterHint: "haircut" },
  { word: "bakery", imposterHint: "bread" },
  { word: "stadium", imposterHint: "sports" },
  { word: "pool", imposterHint: "swimming" },
  { word: "campsite", imposterHint: "tent" },
  { word: "spaceship", imposterHint: "astronaut" },
  { word: "castle", imposterHint: "king" },
  { word: "pirate ship", imposterHint: "treasure" },
  { word: "haunted house", imposterHint: "ghost" },
  { word: "circus", imposterHint: "clown" },
  { word: "volcano", imposterHint: "lava" },
];

export const NUMBER_CATEGORIES: string[] = [
  "How good is this experience? (0–10)",
  "How awkward is this situation? (0–10)",
  "How stressful is this? (0–10)",
  "How good a first-date idea is this? (0–10)",
  "How nostalgic is this? (0–10)",
  "How scary is this? (0–10)",
  "How overrated is this? (0–10)",
  "How embarrassing is this? (0–10)",
  "How relaxing is this? (0–10)",
  "How expensive is this? (0–10)",
  "How healthy is this? (0–10)",
  "How likely would you do this again? (0–10)",
  "How weird is this? (0–10)",
  "How dangerous is this? (0–10)",
  "How exciting is this? (0–10)",
  "How annoying is this? (0–10)",
];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
