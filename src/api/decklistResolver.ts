import type { ParsedLine } from "../lib/deckParser";
import type { CardCategory } from "./types";

/** Stratégie de choix d'impression quand le set+numéro exact ne résout pas. */
export type ResolveStrategy = "exact" | "latest" | "cheapest" | "priciest";

export interface ResolvedLine extends ParsedLine {
  resolved: boolean;
  /** Résolu par nom (impression possiblement différente de la liste d'origine). */
  approx?: boolean;
  cardId?: string;
  imageUrl?: string;
  hp?: number;
  types?: string[];
  subtypes?: string[];
  suffix?: string;
  rarity?: string;
}

const BASE = "https://api.pokemontcg.io/v2/cards";
const SELECT = "id,name,supertype,subtypes,hp,types,number,rarity,images,cardmarket,set";

/** Codes PTCG Live -> ptcgoCode pokemontcg quand ils diffèrent. */
const CODE_ALIASES: Record<string, string> = {
  "PR-SV": "SVP",
  "PR-SW": "SWSHP",
  "PR-SM": "SMP",
  "PR-XY": "XYP",
};

interface PtcgCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  number?: string;
  rarity?: string;
  images?: { small?: string; large?: string };
  cardmarket?: { prices?: { trendPrice?: number; averageSellPrice?: number; lowPrice?: number } };
  set?: { releaseDate?: string };
}

function mapSupertype(s: string | undefined, fallback: CardCategory): CardCategory {
  if (s === "Pokémon" || s === "Pokemon") return "Pokemon";
  if (s === "Trainer") return "Trainer";
  if (s === "Energy") return "Energy";
  return fallback;
}

/** Normalise les sous-types pokemontcg vers notre modèle (stage + suffix). */
function normalizeSubtypes(subtypes?: string[]): { subtypes: string[]; suffix?: string } {
  const out: string[] = [];
  let suffix: string | undefined;
  for (const s of subtypes ?? []) {
    switch (s) {
      case "Stage 1":
        out.push("Stage1");
        break;
      case "Stage 2":
        out.push("Stage2");
        break;
      case "Pokémon Tool":
      case "Pokemon Tool":
        out.push("Tool");
        break;
      case "ex":
      case "EX":
        suffix = "ex";
        break;
      case "V":
        suffix = "V";
        break;
      default:
        // Basic, VMAX, VSTAR, Item, Supporter, Stadium, Special… (alignés)
        out.push(s);
    }
  }
  return { subtypes: out, suffix };
}

function priceOf(c: PtcgCard): number | undefined {
  const p = c.cardmarket?.prices;
  return p?.trendPrice ?? p?.averageSellPrice ?? p?.lowPrice;
}

function releaseEpoch(c: PtcgCard): number {
  const d = c.set?.releaseDate?.replace(/\//g, "-");
  const t = d ? Date.parse(d) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function toResolved(line: ParsedLine, c: PtcgCard, approx: boolean): ResolvedLine {
  const norm = normalizeSubtypes(c.subtypes);
  const hp = c.hp ? parseInt(c.hp, 10) : NaN;
  return {
    ...line,
    name: c.name,
    category: mapSupertype(c.supertype, line.category),
    resolved: true,
    approx,
    cardId: `ptcg:${c.id}`,
    imageUrl: c.images?.small ?? c.images?.large,
    hp: Number.isNaN(hp) ? undefined : hp,
    types: c.types,
    subtypes: norm.subtypes,
    suffix: norm.suffix,
    rarity: c.rarity,
  };
}

async function fetchSetByCode(code: string): Promise<Map<string, PtcgCard>> {
  const map = new Map<string, PtcgCard>();
  const ptcgo = CODE_ALIASES[code] ?? code;
  try {
    const res = await fetch(`${BASE}?q=set.ptcgoCode:${encodeURIComponent(ptcgo)}&pageSize=250&select=${SELECT}`);
    if (!res.ok) return map;
    const json = (await res.json()) as { data?: PtcgCard[] };
    for (const c of json.data ?? []) if (c.number) map.set(String(c.number), c);
  } catch {
    /* best-effort */
  }
  return map;
}

async function fetchByName(name: string): Promise<PtcgCard[]> {
  try {
    const q = `name:"${name.replace(/["\\]/g, "")}"`;
    const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&pageSize=250&select=${SELECT}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: PtcgCard[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

/** Choisit l'impression selon la stratégie (la plus récente / moins chère / plus chère). */
function pickPrinting(cards: PtcgCard[], strategy: ResolveStrategy): PtcgCard | undefined {
  if (cards.length === 0) return undefined;
  const arr = [...cards];
  if (strategy === "cheapest") {
    return arr.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity))[0];
  }
  if (strategy === "priciest") {
    return arr.sort((a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1))[0];
  }
  // "latest" (par défaut) : impression la plus récente.
  return arr.sort((a, b) => releaseEpoch(b) - releaseEpoch(a))[0];
}

/**
 * Résout les lignes d'une decklist en cartes (nom, catégorie, image, stats) via
 * pokemontcg.io. D'abord par set+numéro exact (≈1 requête/set) ; si une ligne
 * n'est pas trouvée et que la stratégie l'autorise, on retombe sur une
 * résolution par nom en choisissant l'impression selon la stratégie. Les lignes
 * non résolues restent (cartes manuelles) — aucune perte.
 */
export async function resolveDecklist(
  lines: ParsedLine[],
  strategy: ResolveStrategy = "latest",
): Promise<ResolvedLine[]> {
  const codes = [...new Set(lines.map((l) => l.setCode).filter((c): c is string => !!c))];
  const setMaps = new Map<string, Map<string, PtcgCard>>();
  await Promise.all(codes.map(async (code) => setMaps.set(code, await fetchSetByCode(code))));

  const interim: ResolvedLine[] = lines.map((line) => {
    if (line.setCode && line.number) {
      const card = setMaps.get(line.setCode)?.get(String(line.number));
      if (card) return toResolved(line, card, false);
    }
    return { ...line, resolved: false };
  });

  if (strategy === "exact") return interim;

  // Repli par nom pour les lignes non résolues (cache par nom).
  const nameCache = new Map<string, PtcgCard[]>();
  return Promise.all(
    interim.map(async (r) => {
      if (r.resolved || !r.name) return r;
      const key = r.name.toLowerCase();
      let cards = nameCache.get(key);
      if (!cards) {
        cards = await fetchByName(r.name);
        nameCache.set(key, cards);
      }
      const picked = pickPrinting(cards, strategy);
      return picked ? toResolved(r, picked, true) : r;
    }),
  );
}
