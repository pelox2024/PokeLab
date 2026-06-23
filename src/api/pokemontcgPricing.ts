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

/**
 * Récupère le prix Cardmarket exact d'une carte via pokemontcg.io.
 * Retourne null si aucune correspondance fiable (on retombera sur TCGdex).
 */
export async function fetchPokemontcgPricing(
  query: PokemontcgQuery,
): Promise<CardPricing | null> {
  const name = escapeLucene(query.name).trim();
  if (!name) return null;

  const parts = [`name:"${name}"`];
  if (query.number) parts.push(`number:${escapeLucene(query.number)}`);
  const q = parts.join(" ");

  const url = `${BASE}?q=${encodeURIComponent(q)}&pageSize=12`;
  let cards: PtcgCard[];
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PtcgCard[] };
    cards = json.data ?? [];
  } catch {
    return null;
  }
  if (!cards.length) return null;

  // Match prioritaire sur l'extension (nom de set), sinon résultat unique.
  let card: PtcgCard | undefined;
  if (query.setName) {
    const target = query.setName.toLowerCase();
    card = cards.find((c) => (c.set?.name ?? "").toLowerCase() === target);
  }
  if (!card && cards.length === 1) card = cards[0];
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
