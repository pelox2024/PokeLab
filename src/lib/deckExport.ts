import type { DeckCard } from "../db/schema";
import type { SetInfo } from "../api/types";

/**
 * Génère une decklist au format PTCG Live / Limitless :
 *
 *   Pokémon: 12
 *   3 Charizard ex OBF 125
 *   ...
 *   Trainer: 36
 *   ...
 *   Energy: 12
 *   6 Fire Energy SVE 2
 *
 * Ligne = `quantité Nom CODE numéro`. Le CODE est le ptcgoCode de l'extension
 * (ex. "OBF"), récupéré via la liste des sets ; à défaut on retombe sur le code
 * interne en majuscules. Ce format se colle dans PTCG Live (« Importer ») et
 * sur Limitless.
 */
const SECTIONS: { label: string; category: DeckCard["category"] }[] = [
  { label: "Pokémon", category: "Pokemon" },
  { label: "Trainer", category: "Trainer" },
  { label: "Energy", category: "Energy" },
];

export function buildDecklistText(cards: DeckCard[], sets?: SetInfo[]): string {
  const codeOf = new Map((sets ?? []).map((s) => [s.id, s.ptcgoCode] as const));
  const sum = (cs: DeckCard[]) => cs.reduce((n, c) => n + c.quantity, 0);

  const lineOf = (c: DeckCard) => {
    const code = (c.setCode && codeOf.get(c.setCode)) || c.setCode?.toUpperCase();
    const parts = [String(c.quantity), c.name];
    if (code && c.number) parts.push(code, c.number);
    return parts.join(" ");
  };

  const out: string[] = [];
  const used = new Set<string>();

  for (const s of SECTIONS) {
    const cs = cards
      .filter((c) => c.category === s.category)
      .sort((a, b) => a.name.localeCompare(b.name));
    cs.forEach((c) => used.add(c.id));
    if (!cs.length) continue;
    out.push(`${s.label}: ${sum(cs)}`);
    for (const c of cs) out.push(lineOf(c));
    out.push("");
  }

  const others = cards.filter((c) => !used.has(c.id));
  if (others.length) {
    out.push(`Other: ${sum(others)}`);
    for (const c of others) out.push(lineOf(c));
  }

  return out.join("\n").trim();
}
