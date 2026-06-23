/**
 * Provider TCGdex (provider principal de la V1).
 * REST, sans clé, multilingue. Doc: https://tcgdex.dev/rest
 *
 * Particularités exploitées :
 * - la liste renvoie un "brief" léger { id, localId, name, image }. Les détails
 *   nécessitent un appel par carte -> getCard().
 * - les IDs sont identiques entre langues -> recherche bilingue EN/FR par fusion.
 */

import { cardmarketSearchUrl, isFullArtRarity, resolveFoilStyle } from "../lib/foil";
import type {
  Ability,
  Attack,
  CardBrief,
  CardCategory,
  CardFilters,
  CardLang,
  CardPage,
  CardPricing,
  CardProvider,
  CardQuery,
  CardRecord,
  CardVariants,
  SetInfo,
  SortKey,
  WeakRes,
} from "./types";

const PROVIDER_ID = "tcgdex";
const BASE = "https://api.tcgdex.net/v2";

/** Langue principale d'affichage (préférence utilisateur). EN par défaut. */
let displayLang: CardLang = "en";
/** Recherche bilingue activée (cherche EN + FR et fusionne). */
let bilingualSearch = true;

export function setDisplayLang(lang: CardLang) {
  displayLang = lang;
}
export function setBilingualSearch(enabled: boolean) {
  bilingualSearch = enabled;
}
/** Compat ascendante (Lot 1). */
export function setCardLang(lang: string) {
  if (lang === "en" || lang === "fr") displayLang = lang;
}

function secondaryLang(): CardLang {
  return displayLang === "en" ? "fr" : "en";
}

function imageUrl(image: string | undefined, quality: "high" | "low" = "high"): string | undefined {
  if (!image) return undefined;
  return `${image}/${quality}.webp`;
}

function mapCategory(raw: string | undefined): CardCategory {
  switch (raw) {
    case "Pokemon":
      return "Pokemon";
    case "Trainer":
      return "Trainer";
    case "Energy":
      return "Energy";
    default:
      return "Unknown";
  }
}

/** Mapping sous-type UI -> (champ API, valeur). */
const SUBTYPE_PARAM: Record<string, [string, string]> = {
  Basic: ["stage", "Basic"],
  Stage1: ["stage", "Stage1"],
  Stage2: ["stage", "Stage2"],
  ex: ["suffix", "ex"],
  Item: ["trainerType", "Item"],
  Supporter: ["trainerType", "Supporter"],
  Stadium: ["trainerType", "Stadium"],
  Tool: ["trainerType", "Tool"],
  SpecialEnergy: ["energyType", "Special"],
};

function applyFilters(params: URLSearchParams, filters?: CardFilters) {
  if (!filters) return;
  if (filters.category) params.set("category", filters.category);
  if (filters.type) params.set("types", filters.type);
  if (filters.rarity) params.set("rarity", `eq:${filters.rarity}`);
  if (filters.set) params.set("set", `eq:${filters.set}`);
  if (filters.regulationMark) params.set("regulationMark", filters.regulationMark);
  if (filters.standardLegal) params.set("legal.standard", "true");
  if (filters.subtype) {
    const map = SUBTYPE_PARAM[filters.subtype];
    if (map) params.set(map[0], map[1]);
  }
}

function sortParams(params: URLSearchParams, sort?: SortKey) {
  // Seul le tri par "name" est fiable côté serveur sur les briefs TCGdex.
  params.set("sort:field", "name");
  params.set("sort:order", sort === "name-desc" ? "DESC" : "ASC");
}

interface TcgdexBrief {
  id: string;
  localId?: string;
  name: string;
  image?: string;
}

interface TcgdexCard {
  id: string;
  localId?: string;
  name: string;
  image?: string;
  category?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  suffix?: string;
  trainerType?: string;
  energyType?: string;
  rarity?: string;
  regulationMark?: string;
  retreat?: number;
  evolveFrom?: string;
  illustrator?: string;
  attacks?: { name: string; cost?: string[]; damage?: string | number; effect?: string }[];
  abilities?: { name: string; type?: string; effect?: string }[];
  weaknesses?: { type: string; value?: string }[];
  resistances?: { type: string; value?: string }[];
  legal?: { standard?: boolean; expanded?: boolean };
  set?: { id: string; name: string };
  variants?: {
    normal?: boolean;
    reverse?: boolean;
    holo?: boolean;
    firstEdition?: boolean;
    wPromo?: boolean;
  };
  variants_detailed?: { type?: string; size?: string }[];
  foil?: string | null;
  pricing?: {
    cardmarket?: TcgdexCmPricing;
    tcgplayer?: Record<string, unknown> & { unit?: string };
  };
}

interface TcgdexCmPricing {
  unit?: string;
  updated?: string;
  avg?: number;
  low?: number;
  trend?: number;
  avg7?: number;
  avg30?: number;
  "avg-holo"?: number | null;
  "low-holo"?: number | null;
  "trend-holo"?: number | null;
  "avg7-holo"?: number | null;
  "avg30-holo"?: number | null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TCGdex ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

function buildListUrl(lang: CardLang, query: CardQuery, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("name", query.search.trim());
  applyFilters(params, query.filters);
  params.set("pagination:page", String(page));
  params.set("pagination:itemsPerPage", String(pageSize));
  sortParams(params, query.sort);
  return `${BASE}/${lang}/cards?${params.toString()}`;
}

async function fetchBriefs(
  lang: CardLang,
  query: CardQuery,
  page: number,
  pageSize: number,
): Promise<TcgdexBrief[]> {
  return fetchJson<TcgdexBrief[]>(buildListUrl(lang, query, page, pageSize));
}

function buildVariants(c: TcgdexCard): CardVariants | undefined {
  if (!c.variants) return undefined;
  const jumbo = c.variants_detailed?.some((v) => v.size === "jumbo");
  return {
    normal: c.variants.normal,
    reverse: c.variants.reverse,
    holo: c.variants.holo,
    firstEdition: c.variants.firstEdition,
    jumbo,
  };
}

function buildSubtypes(c: TcgdexCard): string[] {
  const out: string[] = [];
  if (c.stage) out.push(c.stage);
  if (c.trainerType) out.push(c.trainerType);
  if (c.energyType) out.push(c.energyType);
  return out;
}

function mapAttacks(c: TcgdexCard): Attack[] | undefined {
  if (!c.attacks?.length) return undefined;
  return c.attacks.map((a) => ({
    name: a.name,
    cost: a.cost,
    damage: a.damage != null ? String(a.damage) : undefined,
    effect: a.effect,
  }));
}

function mapAbilities(c: TcgdexCard): Ability[] | undefined {
  if (!c.abilities?.length) return undefined;
  return c.abilities.map((a) => ({ name: a.name, type: a.type, effect: a.effect }));
}

function mapWeakRes(list?: { type: string; value?: string }[]): WeakRes[] | undefined {
  if (!list?.length) return undefined;
  return list.map((w) => ({ type: w.type, value: w.value }));
}

function mapPricing(c: TcgdexCard, searchName: string): CardPricing[] | undefined {
  const cm = c.pricing?.cardmarket;
  if (!cm) return undefined;
  const currency = cm.unit === "EUR" ? "EUR" : cm.unit === "USD" ? "USD" : "EUR";

  // Garde de plausibilité : TCGdex lie parfois une carte full-art au produit
  // de la version commune -> prix plancher (~0,02 €) absurde pour une SIR.
  const fullCard = isFullArtRarity(c.rarity);
  const looksLikeBaseFloor = (cm.low ?? 1) <= 0.05 && (cm.avg ?? 99) < 2;
  const confidence: CardPricing["confidence"] = fullCard && looksLikeBaseFloor ? "low" : "high";

  const entry: CardPricing = {
    provider: "cardmarket",
    currency,
    low: cm.low ?? undefined,
    avg: cm.avg ?? undefined,
    trend: cm.trend ?? undefined,
    avg7: cm.avg7 ?? undefined,
    avg30: cm.avg30 ?? undefined,
    holoLow: cm["low-holo"] ?? undefined,
    holoAvg: cm["avg-holo"] ?? undefined,
    holoTrend: cm["trend-holo"] ?? undefined,
    holoAvg7: cm["avg7-holo"] ?? undefined,
    holoAvg30: cm["avg30-holo"] ?? undefined,
    updatedAt: cm.updated,
    sourceUrl: cardmarketSearchUrl(searchName, c.set?.name),
    confidence,
  };
  // Au moins une valeur de prix utile.
  if (entry.avg == null && entry.low == null && entry.trend == null) return undefined;
  return [entry];
}

export class TcgdexProvider implements CardProvider {
  readonly id = PROVIDER_ID;

  async searchCards(query: CardQuery): Promise<CardPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 40;
    const hasSearch = !!query.search?.trim();

    // Recherche bilingue uniquement quand l'utilisateur tape du texte
    // (sinon on doublerait inutilement les requêtes en navigation).
    if (hasSearch && bilingualSearch) {
      const [primaryRes, secondaryRes] = await Promise.allSettled([
        fetchBriefs(displayLang, query, page, pageSize),
        fetchBriefs(secondaryLang(), query, page, pageSize),
      ]);

      const primary = primaryRes.status === "fulfilled" ? primaryRes.value : [];
      // Si la langue secondaire échoue, on continue avec la principale.
      const secondary = secondaryRes.status === "fulfilled" ? secondaryRes.value : [];

      // Si la principale a échoué mais pas la secondaire, on bascule.
      if (primaryRes.status === "rejected" && secondaryRes.status === "rejected") {
        throw primaryRes.reason;
      }

      const items = this.mergeBilingual(primary, secondary, query.sort);
      return {
        items,
        page,
        pageSize,
        hasMore: primary.length === pageSize || secondary.length === pageSize,
      };
    }

    const data = await fetchBriefs(displayLang, query, page, pageSize);
    const items: CardBrief[] = data.map((b) => this.briefFromSingle(b));
    return { items, page, pageSize, hasMore: data.length === pageSize };
  }

  private briefFromSingle(b: TcgdexBrief): CardBrief {
    const nameKey = displayLang === "fr" ? "nameFr" : "nameEn";
    return {
      id: `${PROVIDER_ID}:${b.id}`,
      provider: PROVIDER_ID,
      providerId: b.id,
      name: b.name,
      displayName: b.name,
      [nameKey]: b.name,
      localId: b.localId,
      imageUrl: imageUrl(b.image, "high"),
    };
  }

  /** Fusionne les résultats EN/FR par id et construit les briefs bilingues. */
  private mergeBilingual(
    primary: TcgdexBrief[],
    secondary: TcgdexBrief[],
    sort?: SortKey,
  ): CardBrief[] {
    const isFr = displayLang === "fr";
    const map = new Map<
      string,
      { localId?: string; image?: string; primaryName?: string; secondaryName?: string }
    >();

    for (const b of primary) {
      map.set(b.id, { localId: b.localId, image: b.image, primaryName: b.name });
    }
    for (const b of secondary) {
      const existing = map.get(b.id);
      if (existing) {
        existing.secondaryName = b.name;
        if (!existing.image) existing.image = b.image;
      } else {
        map.set(b.id, { localId: b.localId, image: b.image, secondaryName: b.name });
      }
    }

    const items: CardBrief[] = [];
    for (const [id, v] of map) {
      const displayName = v.primaryName ?? v.secondaryName ?? "";
      const nameFr = isFr ? v.primaryName : v.secondaryName;
      const nameEn = isFr ? v.secondaryName : v.primaryName;
      const aliases = [nameFr, nameEn].filter((n): n is string => !!n && n !== displayName);
      items.push({
        id: `${PROVIDER_ID}:${id}`,
        provider: PROVIDER_ID,
        providerId: id,
        name: nameEn ?? displayName, // canonique EN pour les decklists
        nameEn,
        nameFr,
        displayName,
        searchAliases: aliases.length ? aliases : undefined,
        localId: v.localId,
        imageUrl: imageUrl(v.image, "high"),
      });
    }

    items.sort((a, b) =>
      sort === "name-desc"
        ? b.displayName.localeCompare(a.displayName)
        : a.displayName.localeCompare(b.displayName),
    );
    return items;
  }

  async getCard(providerId: string): Promise<CardRecord> {
    const primaryUrl = `${BASE}/${displayLang}/cards/${encodeURIComponent(providerId)}`;
    const secondaryUrl = `${BASE}/${secondaryLang()}/cards/${encodeURIComponent(providerId)}`;

    const [primaryRes, secondaryRes] = await Promise.allSettled([
      fetchJson<TcgdexCard>(primaryUrl),
      fetchJson<TcgdexCard>(secondaryUrl),
    ]);

    if (primaryRes.status === "rejected") throw primaryRes.reason;
    const c = primaryRes.value;
    const other = secondaryRes.status === "fulfilled" ? secondaryRes.value : undefined;

    const isFr = displayLang === "fr";
    const nameFr = isFr ? c.name : other?.name;
    const nameEn = isFr ? other?.name : c.name;

    const variants = buildVariants(c);
    const { foilStyle, hasFoilEffect } = resolveFoilStyle({
      foil: c.foil,
      rarity: c.rarity,
      variants,
    });

    return {
      id: `${PROVIDER_ID}:${c.id}`,
      provider: PROVIDER_ID,
      providerId: c.id,
      name: nameEn ?? c.name, // canonique EN
      nameEn,
      nameFr,
      displayName: c.name,
      category: mapCategory(c.category),
      subtypes: buildSubtypes(c),
      suffix: c.suffix,
      types: c.types ?? [],
      hp: c.hp,
      setId: c.set?.id,
      setName: c.set?.name,
      number: c.localId,
      rarity: c.rarity,
      regulationMark: c.regulationMark,
      imageUrl: imageUrl(c.image, "high"),
      attacks: mapAttacks(c),
      abilities: mapAbilities(c),
      weakness: mapWeakRes(c.weaknesses),
      resistance: mapWeakRes(c.resistances),
      retreatCost: c.retreat,
      legalities: c.legal
        ? { standard: c.legal.standard ?? false, expanded: c.legal.expanded ?? false }
        : undefined,
      variants,
      foil: c.foil ?? undefined,
      hasFoilEffect,
      foilStyle,
      pricing: mapPricing(c, nameEn ?? c.name),
      evolveFrom: c.evolveFrom,
      illustrator: c.illustrator,
      raw: c,
    };
  }

  async getSets(): Promise<SetInfo[]> {
    const url = `${BASE}/${displayLang}/sets`;
    const data = await fetchJson<
      { id: string; name: string; logo?: string; cardCount?: { total: number } }[]
    >(url);
    return data.map((s) => ({
      id: s.id,
      name: s.name,
      cardCount: s.cardCount?.total,
      logoUrl: s.logo ? `${s.logo}.webp` : undefined,
    }));
  }
}

export const tcgdexProvider = new TcgdexProvider();
