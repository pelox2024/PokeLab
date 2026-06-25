import type { ParsedLine } from "../lib/deckParser";
import type { CardBrief, CardCategory, SetInfo } from "./types";
import { activeProvider } from "./cardApi";

/** Stratégie de choix d'impression quand le set+numéro exact ne résout pas. */
export type ResolveStrategy = "exact" | "latest" | "cheapest" | "priciest";

export interface ResolvedLine extends ParsedLine {
  resolved: boolean;
  /** Résolu par nom (impression possiblement différente de la liste d'origine). */
  approx?: boolean;
  /** Provider de la carte résolue (pour info/debug). */
  source?: "tcgdex" | "pokemontcg";
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

/** Codes PTCG Live -> ptcgoCode quand ils diffèrent. */
const CODE_ALIASES: Record<string, string> = {
  "PR-SV": "SVP",
  "PR-SW": "SWSHP",
  "PR-SM": "SMP",
  "PR-XY": "XYP",
};
const alias = (code: string) => CODE_ALIASES[code] ?? code;

/* ============================================================
   Phase 1 — résolution TCGdex (catalogue de l'app)
   Images cohérentes, détail fonctionnel, stats via ré-enrichissement.
   ============================================================ */

async function tcgdexSetMap(setId: string): Promise<Map<string, CardBrief>> {
  const map = new Map<string, CardBrief>();
  try {
    const page = await activeProvider.searchCards({ filters: { set: setId }, pageSize: 600 });
    for (const b of page.items) {
      if (!b.localId) continue;
      map.set(b.localId, b);
      const n = parseInt(b.localId, 10);
      if (!Number.isNaN(n)) map.set(String(n), b); // tolère le zéro-padding
    }
  } catch {
    /* best-effort */
  }
  return map;
}

function fromTcgdex(line: ParsedLine, b: CardBrief): ResolvedLine {
  // category/hp/types/subtypes laissés au ré-enrichissement de fond (briefs minimaux).
  return {
    ...line,
    name: b.name,
    resolved: true,
    source: "tcgdex",
    cardId: b.id,
    imageUrl: b.imageUrl,
  };
}

/* ============================================================
   Phase 2 — repli pokemontcg (nom + stats directes)
   ============================================================ */

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
        out.push(s);
    }
  }
  return { subtypes: out, suffix };
}

const priceOf = (c: PtcgCard) => {
  const p = c.cardmarket?.prices;
  return p?.trendPrice ?? p?.averageSellPrice ?? p?.lowPrice;
};
function releaseEpoch(c: PtcgCard): number {
  const t = c.set?.releaseDate ? Date.parse(c.set.releaseDate.replace(/\//g, "-")) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function fromPtcg(line: ParsedLine, c: PtcgCard, approx: boolean): ResolvedLine {
  const norm = normalizeSubtypes(c.subtypes);
  const hp = c.hp ? parseInt(c.hp, 10) : NaN;
  return {
    ...line,
    name: c.name,
    category: mapSupertype(c.supertype, line.category),
    resolved: true,
    approx,
    source: "pokemontcg",
    cardId: `ptcg:${c.id}`,
    imageUrl: c.images?.small ?? c.images?.large,
    hp: Number.isNaN(hp) ? undefined : hp,
    types: c.types,
    subtypes: norm.subtypes,
    suffix: norm.suffix,
    rarity: c.rarity,
  };
}

async function ptcgSetByCode(code: string): Promise<Map<string, PtcgCard>> {
  const map = new Map<string, PtcgCard>();
  try {
    const res = await fetch(`${BASE}?q=set.ptcgoCode:${encodeURIComponent(alias(code))}&pageSize=250&select=${SELECT}`);
    if (!res.ok) return map;
    const json = (await res.json()) as { data?: PtcgCard[] };
    for (const c of json.data ?? []) if (c.number) map.set(String(c.number), c);
  } catch {
    /* best-effort */
  }
  return map;
}

async function ptcgByName(name: string): Promise<PtcgCard[]> {
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

function pickPrinting(cards: PtcgCard[], strategy: ResolveStrategy): PtcgCard | undefined {
  if (cards.length === 0) return undefined;
  const arr = [...cards];
  if (strategy === "cheapest") return arr.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity))[0];
  if (strategy === "priciest") return arr.sort((a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1))[0];
  return arr.sort((a, b) => releaseEpoch(b) - releaseEpoch(a))[0]; // latest
}

async function resolvePtcg(lines: ResolvedLine[], strategy: ResolveStrategy): Promise<ResolvedLine[]> {
  const codes = [...new Set(lines.map((l) => l.setCode).filter((c): c is string => !!c))];
  const setMaps = new Map<string, Map<string, PtcgCard>>();
  await Promise.all(codes.map(async (code) => setMaps.set(code, await ptcgSetByCode(code))));

  const interim = lines.map((line) => {
    if (line.setCode && line.number) {
      const card = setMaps.get(line.setCode)?.get(String(line.number));
      if (card) return fromPtcg(line, card, false);
    }
    return line;
  });

  if (strategy === "exact") return interim;

  const nameCache = new Map<string, PtcgCard[]>();
  return Promise.all(
    interim.map(async (r) => {
      if (r.resolved || !r.name) return r;
      const key = r.name.toLowerCase();
      let cards = nameCache.get(key);
      if (!cards) {
        cards = await ptcgByName(r.name);
        nameCache.set(key, cards);
      }
      const picked = pickPrinting(cards, strategy);
      return picked ? fromPtcg(r, picked, true) : r;
    }),
  );
}

export interface ResolveOptions {
  sets?: SetInfo[];
  strategy?: ResolveStrategy;
}

/**
 * Résout une decklist en cartes. D'abord via le catalogue TCGdex (set+numéro,
 * en mappant le code PTCGO → set TCGdex) pour des images cohérentes et un détail
 * fonctionnel ; repli sur pokemontcg (set+numéro puis nom selon la stratégie)
 * pour les cartes que TCGdex ne couvre pas. Aucune ligne n'est perdue.
 */
export async function resolveDecklist(lines: ParsedLine[], opts: ResolveOptions = {}): Promise<ResolvedLine[]> {
  const strategy = opts.strategy ?? "latest";
  const sets = opts.sets ?? [];

  // Code PTCGO (alias appliqué) -> id de set TCGdex.
  const ptcgoToSetId = new Map<string, string>();
  for (const s of sets) if (s.ptcgoCode) ptcgoToSetId.set(s.ptcgoCode.toUpperCase(), s.id);

  // Phase 1 : TCGdex par set + numéro.
  const codeToSetId = new Map<string, string>();
  for (const code of new Set(lines.map((l) => l.setCode).filter((c): c is string => !!c))) {
    const setId = ptcgoToSetId.get(alias(code).toUpperCase());
    if (setId) codeToSetId.set(code, setId);
  }
  const tcgdexMaps = new Map<string, Map<string, CardBrief>>();
  await Promise.all([...codeToSetId].map(async ([code, setId]) => tcgdexMaps.set(code, await tcgdexSetMap(setId))));

  const phase1: ResolvedLine[] = lines.map((line) => {
    if (line.setCode && line.number) {
      const b = tcgdexMaps.get(line.setCode)?.get(String(line.number));
      if (b) return fromTcgdex(line, b);
    }
    return { ...line, resolved: false };
  });

  // Phase 2 : repli pokemontcg pour les lignes restantes.
  const idx = phase1.map((r, i) => ({ r, i })).filter((x) => !x.r.resolved);
  if (idx.length === 0) return phase1;

  const fallback = await resolvePtcg(
    idx.map((x) => x.r),
    strategy,
  );
  const out = [...phase1];
  idx.forEach((x, k) => (out[x.i] = fallback[k]));
  return out;
}
