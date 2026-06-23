/**
 * Source de PRIX exacte via pokemontcg.io.
 * Contrairement à TCGdex, pokemontcg.io fournit des prix Cardmarket par carte
 * exacte + une URL produit (redirection vers la bonne page Cardmarket).
 *
 * Sans clé : 1000 req/jour, 30/min. On l'appelle uniquement à l'ouverture de
 * la modal (lazy) et le résultat est mis en cache par TanStack Query.
 * EN uniquement -> on matche sur le nom canonique anglais.
 */

import type { CardPricing } from "./types";

const BASE = "https://api.pokemontcg.io/v2/cards";

interface PtcgCardmarket {
  url?: string;
  updatedAt?: string;
  prices?: {
    averageSellPrice?: number;
    lowPrice?: number;
    trendPrice?: number;
    reverseHoloSell?: number;
    reverseHoloLow?: number;
    reverseHoloTrend?: number;
  };
}

interface PtcgCard {
  id: string;
  name: string;
  number?: string;
  set?: { name?: string };
  cardmarket?: PtcgCardmarket;
}

function escapeLucene(value: string): string {
  // On garde les guillemets autour de la valeur -> il suffit d'échapper les "
  return value.replace(/"/g, "");
}

export interface PokemontcgQuery {
  name: string; // nom canonique EN
  number?: string;
  setName?: string;
}

/** pokemontcg n'utilise pas de zéros de tête (TCGdex pad: "004" -> "4"). */
function normalizeNumber(num?: string): string | undefined {
  if (!num) return undefined;
  if (/^\d+$/.test(num)) return String(parseInt(num, 10));
  return num; // alphanumérique (promos: SWSH251, TG24…) inchangé
}

async function queryCards(q: string): Promise<PtcgCard[]> {
  try {
    const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&pageSize=20`);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: PtcgCard[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

function pickBySet(cards: PtcgCard[], setName?: string, number?: string): PtcgCard | undefined {
  if (!cards.length) return undefined;
  const target = setName?.toLowerCase();
  let pool = cards;
  if (target) {
    const bySet = cards.filter((c) => (c.set?.name ?? "").toLowerCase() === target);
    if (bySet.length) pool = bySet;
  }
  if (number) {
    const byNum = pool.find((c) => c.number === number);
    if (byNum) return byNum;
  }
  return pool.length === 1 ? pool[0] : target ? pool[0] : undefined;
}

/**
 * Récupère le prix Cardmarket exact d'une carte via pokemontcg.io.
 * Retourne null si aucune correspondance fiable (on retombera sur TCGdex).
 */
export async function fetchPokemontcgPricing(
  query: PokemontcgQuery,
): Promise<CardPricing | null> {
  const name = escapeLucene(query.name).trim();
  if (!name) return null;
  const number = normalizeNumber(query.number);

  // 1) nom + numéro normalisé
  let cards: PtcgCard[] = [];
  if (number) cards = await queryCards(`name:"${name}" number:${escapeLucene(number)}`);
  let card = pickBySet(cards, query.setName, number);

  // 2) repli : nom seul, on filtre par extension (+ numéro si possible)
  if (!card) {
    cards = await queryCards(`name:"${name}"`);
    card = pickBySet(cards, query.setName, number);
  }
  if (!card) return null;

  const cm = card.cardmarket;
  const prices = cm?.prices;
  if (!cm || !prices) return null;

  const hasPrice =
    prices.averageSellPrice != null || prices.lowPrice != null || prices.trendPrice != null;
  if (!hasPrice) return null;

  return {
    provider: "cardmarket",
    currency: "EUR",
    low: prices.lowPrice ?? undefined,
    avg: prices.averageSellPrice ?? undefined,
    trend: prices.trendPrice ?? undefined,
    holoLow: prices.reverseHoloLow ?? undefined,
    holoAvg: prices.reverseHoloSell ?? undefined,
    holoTrend: prices.reverseHoloTrend ?? undefined,
    updatedAt: cm.updatedAt,
    sourceUrl: cm.url, // page produit exacte (redirection Cardmarket)
    confidence: "exact",
    confidenceReason: "Prix exact (pokemontcg.io)",
  };
}
