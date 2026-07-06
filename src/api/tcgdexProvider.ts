/**
 * Provider TCGdex (provider principal de la V1).
 * REST, sans clé, multilingue. Doc: https://tcgdex.dev/rest
 *
 * Particularités exploitées :
 * - la liste renvoie un "brief" léger { id, localId, name, image }. Les détails
 *   nécessitent un appel par carte -> getCard().
 * - les IDs sont identiques entre langues -> recherche bilingue EN/FR par fusion.
 */

import { resolveFoilStyle } from "../lib/foil";
import { cardmarketSearchUrl, evaluatePriceConfidence } from "../lib/pricing";
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
export function getDisplayLang(): CardLang {
  return displayLang;
}
export function setBilingualSearch(enabled: boolean) {
  bilingualSearch = enabled;
}
export function getBilingualSearch(): boolean {
  return bilingualSearch;
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
  VMAX: ["stage", "VMAX"],
  VSTAR: ["stage", "VSTAR"],
  ex: ["suffix", "ex"],
  V: ["suffix", "V"],
  Item: ["trainerType", "Item"],
  Supporter: ["trainerType", "Supporter"],
  Stadium: ["trainerType", "Stadium"],
  Tool: ["trainerType", "Tool"],
  SpecialEnergy: ["energyType", "Special"],
};

/** OR natif TCGdex : valeurs jointes par `|`. */
function joinOr(values?: string[]): string | undefined {
  return values && values.length ? values.join("|") : undefined;
}

function applyFilters(params: URLSearchParams, filters?: CardFilters) {
  if (!filters) return;

  const cat = joinOr(filters.categories);
  if (cat) params.set("category", cat);

  const types = joinOr(filters.types);
  if (types) params.set("types", types);

  if (filters.rarities?.length) params.set("rarity", `eq:${filters.rarities.join("|")}`);

  const marks = joinOr(filters.regulationMarks);
  if (marks) params.set("regulationMark", marks);

  if (filters.set) params.set("set", `eq:${filters.set}`);
  if (filters.standardLegal) params.set("legal.standard", "true");
  if (filters.expandedLegal) params.set("legal.expanded", "true");

  // Sous-types : regroupés par champ API (OR au sein d'un champ, AND entre champs)
  if (filters.subtypes?.length) {
    const byField: Record<string, string[]> = {};
    for (const st of filters.subtypes) {
      const map = SUBTYPE_PARAM[st];
      if (!map) continue;
      (byField[map[0]] ??= []).push(map[1]);
    }
    for (const [field, vals] of Object.entries(byField)) {
      params.set(field, vals.join("|"));
    }
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
  const hasPrice = cm.avg != null || cm.low != null || cm.trend != null;
  if (!hasPrice) return undefined;

  const currency = cm.unit === "EUR" ? "EUR" : cm.unit === "USD" ? "USD" : "EUR";

  // TCGdex ne fournit pas de page produit exacte -> jamais "exact".
  // La heuristique bascule en "unsafe" si une carte spéciale a un prix plancher.
  const { confidence, reason } = evaluatePriceConfidence({
    rarity: c.rarity,
    low: cm.low ?? undefined,
    avg: cm.avg ?? undefined,
    hasExactUrl: false,
    hasPrice: true,
  });

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
    searchUrl: cardmarketSearchUrl(searchName),
    confidence,
    confidenceReason: reason,
  };
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
      imageUrl: imageUrl(b.image, "low"), // vignette grille (rapide) ; détail en "high"
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
        imageUrl: imageUrl(v.image, "low"), // vignette grille (rapide) ; détail en "high"
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
    const [sets, series] = await Promise.all([
      fetchJson<{ id: string; name: string; logo?: string; cardCount?: { total: number } }[]>(
        `${BASE}/${displayLang}/sets`,
      ),
      fetchJson<{ id: string; name: string }[]>(`${BASE}/${displayLang}/series`).catch(() => []),
    ]);

    // Map set -> série par préfixe d'id le plus long (swsh3 -> swsh).
    const seriesByLen = [...series].sort((a, b) => b.id.length - a.id.length);
    const findSeries = (setId: string) => seriesByLen.find((se) => setId.startsWith(se.id));

    return sets.map((s) => {
      const ser = findSeries(s.id);
      return {
        id: s.id,
        name: s.name,
        cardCount: s.cardCount?.total,
        logoUrl: s.logo ? `${s.logo}.webp` : undefined,
        seriesId: ser?.id,
        seriesName: ser?.name,
      };
    });
  }
}

export const tcgdexProvider = new TcgdexProvider();
