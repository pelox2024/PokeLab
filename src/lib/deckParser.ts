import type { CardCategory } from "../api/types";

export interface ParsedLine {
  qty: number;
  name: string;
  setCode?: string;
  number?: string;
  category: CardCategory;
  rawLine: string;
}

export interface ParsedDeck {
  lines: ParsedLine[];
  unparsed: string[];
}

/** Détecte un en-tête de section et la catégorie associée. */
function detectHeader(line: string): CardCategory | null {
  const l = line.trim().toLowerCase();
  if (/^pok[eé]mon\b/.test(l)) return "Pokemon";
  if (/^(trainer|dresseur)s?\b/.test(l) || /cartes?\s+dresseur/.test(l)) return "Trainer";
  if (/^([eé]nergi?e|energy)s?\b/.test(l) || /cartes?\s+[eé]nergie/.test(l)) return "Energy";
  return null;
}

// "4 Teal Mask Ogerpon ex TWM 211" / "1 Noctowl PR-SV 141" / "14 Grass Energy PK 103"
const FULL = /^(\d+)\s+(.+?)\s+([A-Z]{2,4}(?:-[A-Z]{1,3})?)\s+([A-Za-z0-9]+)$/;
// "4 Professor's Research" (sans set/numéro)
const SIMPLE = /^(\d+)\s+(.+)$/;

/** Parse une decklist (PTCG Live / Limitless / manuelle). Ne perd jamais de ligne. */
export function parseDecklist(text: string): ParsedDeck {
  const lines: ParsedLine[] = [];
  const unparsed: string[] = [];
  let category: CardCategory = "Unknown";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const header = detectHeader(line);
    if (header) {
      category = header;
      continue;
    }

    const full = FULL.exec(line);
    if (full) {
      lines.push({
        qty: parseInt(full[1], 10),
        name: full[2].trim(),
        setCode: full[3].toUpperCase(),
        number: full[4],
        category,
        rawLine: line,
      });
      continue;
    }

    const simple = SIMPLE.exec(line);
    if (simple) {
      lines.push({
        qty: parseInt(simple[1], 10),
        name: simple[2].trim(),
        category,
        rawLine: line,
      });
      continue;
    }

    unparsed.push(line);
  }

  return { lines, unparsed };
}

export interface DeckTotals {
  total: number;
  pokemon: number;
  trainer: number;
  energy: number;
}

export function decklistTotals(lines: ParsedLine[]): DeckTotals {
  const t: DeckTotals = { total: 0, pokemon: 0, trainer: 0, energy: 0 };
  for (const l of lines) {
    t.total += l.qty;
    if (l.category === "Pokemon") t.pokemon += l.qty;
    else if (l.category === "Trainer") t.trainer += l.qty;
    else if (l.category === "Energy") t.energy += l.qty;
  }
  return t;
}
