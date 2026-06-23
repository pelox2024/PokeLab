/**
 * Provider TCGdex (provider principal de la V1).
 * REST, sans clé, multilingue. Doc: https://tcgdex.dev/rest
 *
 * Particularité importante : la liste de cartes renvoie un objet "brief"
 * léger { id, localId, name, image }. Les détails (hp, attaques, faiblesse…)
 * nécessitent un appel sur la carte individuelle -> getCard().
 */

import type {
  Ability,
  Attack,
  CardBrief,
  CardCategory,
  CardPage,
  CardProvider,
  CardQuery,
  CardRecord,
  SetInfo,
  WeakRes,
} from "./types";

const PROVIDER_ID = "tcgdex";
const BASE = "https://api.tcgdex.net/v2";

/** Langue des DONNÉES cartes. EN par défaut (compat imports PTCG Live). */
let cardLang = "en";
export function setCardLang(lang: string) {
  cardLang = lang;
}

/** Construit l'URL d'image finale à partir du champ "image" (sans extension). */
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
  trainerType?: string;
  energyType?: string;
  rarity?: string;
  regulationMark?: string;
  retreat?: number;
  attacks?: { name: string; cost?: string[]; damage?: string | number; effect?: string }[];
  abilities?: { name: string; type?: string; effect?: string }[];
  weaknesses?: { type: string; value?: string }[];
  resistances?: { type: string; value?: string }[];
  legal?: { standard?: boolean; expanded?: boolean };
  set?: { id: string; name: string };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`TCGdex ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Construit les sous-types lisibles (Basic / Stage 1 / ex / Item / Supporter…). */
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

export class TcgdexProvider implements CardProvider {
  readonly id = PROVIDER_ID;

  async searchCards(query: CardQuery, signal?: AbortSignal): Promise<CardPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 40;

    const params = new URLSearchParams();
    if (query.search?.trim()) params.set("name", query.search.trim());
    params.set("pagination:page", String(page));
    params.set("pagination:itemsPerPage", String(pageSize));
    params.set("sort:field", "name");
    params.set("sort:order", "ASC");

    const url = `${BASE}/${cardLang}/cards?${params.toString()}`;
    const data = await fetchJson<TcgdexBrief[]>(url, signal);

    const items: CardBrief[] = data.map((b) => ({
      id: `${PROVIDER_ID}:${b.id}`,
      provider: PROVIDER_ID,
      providerId: b.id,
      name: b.name,
      localId: b.localId,
      imageUrl: imageUrl(b.image, "high"),
    }));

    return {
      items,
      page,
      pageSize,
      hasMore: data.length === pageSize,
    };
  }

  async getCard(providerId: string, signal?: AbortSignal): Promise<CardRecord> {
    const url = `${BASE}/${cardLang}/cards/${encodeURIComponent(providerId)}`;
    const c = await fetchJson<TcgdexCard>(url, signal);

    return {
      id: `${PROVIDER_ID}:${c.id}`,
      provider: PROVIDER_ID,
      providerId: c.id,
      name: c.name,
      category: mapCategory(c.category),
      subtypes: buildSubtypes(c),
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
      raw: c,
    };
  }

  async getSets(signal?: AbortSignal): Promise<SetInfo[]> {
    const url = `${BASE}/${cardLang}/sets`;
    const data = await fetchJson<{ id: string; name: string; cardCount?: { total: number } }[]>(
      url,
      signal,
    );
    return data.map((s) => ({
      id: s.id,
      name: s.name,
      cardCount: s.cardCount?.total,
    }));
  }
}

export const tcgdexProvider = new TcgdexProvider();
