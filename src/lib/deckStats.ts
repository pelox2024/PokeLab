import type { DeckCard } from "../db/schema";
import type { SetInfo } from "../api/types";
import { RARITIES } from "./filters";
import { setRecencyValue } from "./cardSort";

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
  /** Nombre de Pokémon de base (déterminant pour le risque de mulligan). */
  basicCount: number;
  /** Probabilité de mulligan (aucun Pokémon de base dans la main de 7), en %. */
  mulliganPct: number | null;
  /** Récompenses moyennes cédées par Pokémon (1 / 2 ex-V-VSTAR / 3 VMAX). */
  prizeAvg: number;
  /** Répartition des Pokémon par récompenses cédées (en quantités). */
  prizeBreakdown: { one: number; two: number; three: number };
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
      // On ne compte un stade que s'il est connu : une carte non enrichie
      // (sous-types absents) ne doit pas gonfler « De base ».
      if (has(c, "Stage2")) stages.stage2 += q;
      else if (has(c, "Stage1")) stages.stage1 += q;
      else if (has(c, "VMAX") || has(c, "VSTAR")) stages.vEvo += q;
      else if (has(c, "Basic")) stages.basic += q;

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

  // Récompenses cédées par Pokémon : VMAX = 3, ex/V/VSTAR = 2, sinon 1.
  const prizeBreakdown = { one: 0, two: 0, three: 0 };
  let prizeSum = 0;
  for (const c of cards) {
    if (c.category !== "Pokemon") continue;
    const suffix = c.suffix?.toLowerCase();
    let p = 1;
    if (has(c, "VMAX")) p = 3;
    else if (has(c, "VSTAR") || suffix === "ex" || suffix === "v") p = 2;
    prizeSum += p * c.quantity;
    if (p === 3) prizeBreakdown.three += c.quantity;
    else if (p === 2) prizeBreakdown.two += c.quantity;
    else prizeBreakdown.one += c.quantity;
  }
  const prizeAvg = pokemon > 0 ? Math.round((prizeSum / pokemon) * 10) / 10 : 0;

  // Risque de mulligan = P(aucun Pokémon de base dans une main de 7).
  // Hypergéométrique : produit_{i=0..6} (N-B-i)/(N-i). Stable numériquement.
  const basicCount = stages.basic;
  let mulliganPct: number | null = null;
  if (total >= 7 && basicCount >= 0) {
    let p = 1;
    for (let i = 0; i < 7; i++) p *= (total - basicCount - i) / (total - i);
    mulliganPct = Math.max(0, Math.round(p * 1000) / 10);
  }

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
    basicCount,
    mulliganPct,
    prizeAvg,
    prizeBreakdown,
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

/* ============================================================
   Tri / regroupement des cartes du deck (façon LorcaHub)
   ============================================================ */

export type DeckSortKey = "type" | "set" | "series" | "name" | "hp" | "rarity" | "qty";

export interface DeckGroup {
  key: string;
  label: string;
  count: number;
  cards: DeckCard[];
}

const RARITY_RANK = new Map(RARITIES.map((r, i) => [r, i] as const));
const qtySum = (arr: DeckCard[]) => arr.reduce((s, c) => s + c.quantity, 0);

export interface DeckGroupOptions {
  /** Métadonnées des extensions, pour les regroupements Set / Série. */
  sets?: SetInfo[];
}

/** Regroupe par extension (Set) ou série, classé du plus récent au plus ancien. */
function groupBySetField(cards: DeckCard[], sets: SetInfo[], field: "set" | "series"): DeckGroup[] {
  // Les cartes ajoutées via le catalogue ont un setCode = id TCGdex ; les cartes
  // importées ont un setCode = code PTCGO (ex. "TWM"). On résout les deux.
  const byId = new Map(sets.map((s) => [s.id, s]));
  const byCode = new Map(sets.filter((s) => s.ptcgoCode).map((s) => [s.ptcgoCode!.toUpperCase(), s]));
  const lookup = (code?: string) =>
    code ? byId.get(code) ?? byCode.get(code.toUpperCase()) : undefined;
  const map = new Map<string, { label: string; rank: number; cards: DeckCard[] }>();
  for (const c of cards) {
    const set = lookup(c.setCode);
    const key = field === "series" ? set?.seriesId ?? "_" : set?.id ?? c.setCode ?? "_";
    const label =
      field === "series"
        ? set?.seriesName ?? "Série inconnue"
        : set?.name ?? c.setCode?.toUpperCase() ?? "Sans extension";
    const rank = set ? setRecencyValue(set) : -Infinity;
    const g = map.get(key) ?? { label, rank, cards: [] };
    g.cards.push(c);
    map.set(key, g);
  }
  return [...map.values()]
    .sort((a, b) => b.rank - a.rank)
    .map((g) => ({
      key: g.label,
      label: g.label,
      count: qtySum(g.cards),
      cards: [...g.cards].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function buildDeckGroups(cards: DeckCard[], sort: DeckSortKey, opts?: DeckGroupOptions): DeckGroup[] {
  if (sort === "type") {
    const g = groupByCategory(cards);
    return GROUP_ORDER.filter((k) => g[k].length > 0).map((k) => ({
      key: k,
      label: GROUP_LABEL[k],
      count: qtySum(g[k]),
      cards: g[k],
    }));
  }

  if (sort === "set" || sort === "series") {
    return groupBySetField(cards, opts?.sets ?? [], sort);
  }

  if (sort === "rarity") {
    const map = new Map<string, DeckCard[]>();
    for (const c of cards) {
      const r = c.rarity ?? "Sans rareté";
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(c);
    }
    const groups = [...map.entries()].map(([label, cs]) => ({
      key: label,
      label,
      count: qtySum(cs),
      cards: [...cs].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    groups.sort((a, b) => (RARITY_RANK.get(a.label) ?? 999) - (RARITY_RANK.get(b.label) ?? 999));
    return groups;
  }

  // Tris à plat (un seul groupe)
  const sorted = [...cards];
  if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "hp") sorted.sort((a, b) => (b.hp ?? -1) - (a.hp ?? -1) || a.name.localeCompare(b.name));
  else if (sort === "qty") sorted.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));

  const labels: Record<string, string> = { name: "Ordre alphabétique", hp: "Par PV décroissant", qty: "Par quantité" };
  return [{ key: "all", label: labels[sort] ?? "Toutes les cartes", count: qtySum(sorted), cards: sorted }];
}
