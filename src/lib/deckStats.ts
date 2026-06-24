import type { DeckCard } from "../db/schema";

export interface DeckStats {
  total: number;
  pokemon: number;
  trainer: number;
  energy: number;
  other: number;
  warnings: string[];
}

const BASIC_ENERGY =
  /\b(grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon)\s+energy\b/i;

export function isBasicEnergy(c: DeckCard): boolean {
  if (c.category !== "Energy") return false;
  if (c.subtypes?.some((s) => /special/i.test(s))) return false;
  return c.subtypes?.includes("Basic") || BASIC_ENERGY.test(c.name);
}

export function computeStats(cards: DeckCard[]): DeckStats {
  let pokemon = 0;
  let trainer = 0;
  let energy = 0;
  let other = 0;

  for (const c of cards) {
    switch (c.category) {
      case "Pokemon":
        pokemon += c.quantity;
        break;
      case "Trainer":
        trainer += c.quantity;
        break;
      case "Energy":
        energy += c.quantity;
        break;
      default:
        other += c.quantity;
    }
  }
  const total = pokemon + trainer + energy + other;

  const warnings: string[] = [];
  if (total < 60) warnings.push(`Deck incomplet — ${total}/60 cartes`);
  if (total > 60) warnings.push(`Trop de cartes — ${total}/60`);
  for (const c of cards) {
    if (c.quantity > 4 && !isBasicEnergy(c)) {
      warnings.push(`${c.quantity}× ${c.name} (max 4 hors Énergie de base)`);
    }
  }
  const basics = cards.filter((c) => c.category === "Pokemon" && c.subtypes?.includes("Basic")).reduce((s, c) => s + c.quantity, 0);
  if (pokemon > 0 && basics === 0) warnings.push("Aucun Pokémon de base détecté");

  return { total, pokemon, trainer, energy, other, warnings };
}

export type DeckGroupKey = "Pokemon" | "Trainer" | "Energy" | "Unknown";

export const GROUP_ORDER: DeckGroupKey[] = ["Pokemon", "Trainer", "Energy", "Unknown"];

export const GROUP_LABEL: Record<DeckGroupKey, string> = {
  Pokemon: "Pokémon",
  Trainer: "Dresseurs",
  Energy: "Énergies",
  Unknown: "Autres",
};

export function groupByCategory(cards: DeckCard[]): Record<DeckGroupKey, DeckCard[]> {
  const groups: Record<DeckGroupKey, DeckCard[]> = { Pokemon: [], Trainer: [], Energy: [], Unknown: [] };
  for (const c of cards) {
    const key = (["Pokemon", "Trainer", "Energy"].includes(c.category) ? c.category : "Unknown") as DeckGroupKey;
    groups[key].push(c);
  }
  for (const k of GROUP_ORDER) {
    groups[k].sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}
