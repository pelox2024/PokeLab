import type { DeckCard } from "../db/schema";

export interface HpBucket {
  label: string;
  count: number;
}

export interface DeckStats {
  total: number;
  pokemon: number;
  trainer: number;
  energy: number;
  other: number;
  warnings: string[];
  /** Pokémon par niveau d'évolution. */
  stages: { basic: number; stage1: number; stage2: number; vEvo: number };
  /** Dresseurs par type. */
  trainerKinds: { item: number; supporter: number; stadium: number; tool: number };
  /** Énergies de base vs spéciales. */
  energySplit: { basic: number; special: number };
  /** Mécaniques (ex / V / VMAX / VSTAR). */
  mechanics: { ex: number; v: number; vmax: number; vstar: number };
  /** Répartition des types d'énergie (Pokémon), triée. */
  typeCounts: { type: string; count: number }[];
  /** Histogramme de PV (Pokémon) — l'équivalent « courbe » du JCC. */
  hpBuckets: HpBucket[];
  /** PV moyen pondéré des Pokémon connus. */
  avgHp: number;
}

// Tranches de PV (bornes basses incluses). Couvre tout le spectre moderne.
const HP_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "≤70", min: 0, max: 70 },
  { label: "80-110", min: 80, max: 110 },
  { label: "120-150", min: 120, max: 150 },
  { label: "160-200", min: 160, max: 200 },
  { label: "210+", min: 210, max: Infinity },
];

function has(c: DeckCard, value: string): boolean {
  return !!c.subtypes?.some((s) => s.toLowerCase() === value.toLowerCase());
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

  // ---- Analyses détaillées ----
  const stages = { basic: 0, stage1: 0, stage2: 0, vEvo: 0 };
  const trainerKinds = { item: 0, supporter: 0, stadium: 0, tool: 0 };
  const energySplit = { basic: 0, special: 0 };
  const mechanics = { ex: 0, v: 0, vmax: 0, vstar: 0 };
  const typeMap = new Map<string, number>();
  const hpCounts = HP_BUCKETS.map(() => 0);
  let hpSum = 0;
  let hpQty = 0;

  for (const c of cards) {
    const q = c.quantity;
    if (c.category === "Pokemon") {
      if (has(c, "Stage2")) stages.stage2 += q;
      else if (has(c, "Stage1")) stages.stage1 += q;
      else if (has(c, "VMAX") || has(c, "VSTAR")) stages.vEvo += q;
      else stages.basic += q;

      const suffix = c.suffix?.toLowerCase();
      if (suffix === "ex") mechanics.ex += q;
      if (suffix === "v") mechanics.v += q;
      if (has(c, "VMAX")) mechanics.vmax += q;
      if (has(c, "VSTAR")) mechanics.vstar += q;

      for (const t of c.types ?? []) typeMap.set(t, (typeMap.get(t) ?? 0) + q);

      if (c.hp != null && c.hp > 0) {
        hpSum += c.hp * q;
        hpQty += q;
        const idx = HP_BUCKETS.findIndex((b) => c.hp! >= b.min && c.hp! <= b.max);
        if (idx >= 0) hpCounts[idx] += q;
      }
    } else if (c.category === "Trainer") {
      if (has(c, "Supporter")) trainerKinds.supporter += q;
      else if (has(c, "Stadium")) trainerKinds.stadium += q;
      else if (has(c, "Tool")) trainerKinds.tool += q;
      else trainerKinds.item += q;
    } else if (c.category === "Energy") {
      if (isBasicEnergy(c)) energySplit.basic += q;
      else energySplit.special += q;
    }
  }

  const typeCounts = [...typeMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const hpBuckets: HpBucket[] = HP_BUCKETS.map((b, i) => ({ label: b.label, count: hpCounts[i] }));
  const avgHp = hpQty > 0 ? Math.round(hpSum / hpQty) : 0;

  return {
    total,
    pokemon,
    trainer,
    energy,
    other,
    warnings,
    stages,
    trainerKinds,
    energySplit,
    mechanics,
    typeCounts,
    hpBuckets,
    avgHp,
  };
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
