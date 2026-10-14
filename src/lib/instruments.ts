// Instruments are stored in one canonical form (trimmed, single-spaced,
// lowercase) so "Piano", "piano" and " PIANO " are the same instrument for
// search and for the homepage list. Capitalization is purely presentational.

export function normalizeInstrument(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeInstruments(raw: string[]): string[] {
  return Array.from(new Set(raw.map(normalizeInstrument).filter(Boolean)));
}

export function displayInstrument(stored: string): string {
  return stored
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function displayInstruments(stored: string[]): string {
  return stored.map(displayInstrument).join(", ");
}
