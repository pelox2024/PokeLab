import type { CardPricing, CardRecord, PriceConfidence } from "../api/types";
import { isFullArtRarity } from "./foil";

/** Lien de recherche Cardmarket — nom de carte SEUL (le plus fiable). */
export function cardmarketSearchUrl(name: string): string {
  return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(
    name,
  )}`;
}

/** Lien de recherche élargi (nom + extension) — secondaire, parfois vide. */
export function cardmarketSearchUrlWithSet(name: string, setName?: string): string {
  return cardmarketSearchUrl(setName ? `${name} ${setName}` : name);
}

export function pickCardmarket(pricing?: CardPricing[]): CardPricing | undefined {
  return pricing?.find((p) => p.provider === "cardmarket" || p.provider === "tcgdex");
}

interface PriceEval {
  confidence: PriceConfidence;
  reason?: string;
}

/**
 * Heuristique de prudence : décide à quel point on peut faire confiance au prix.
 * Sans page produit exacte (cas TCGdex), on ne dépasse jamais "indicative",
 * et on bascule en "unsafe" si une carte spéciale renvoie un prix plancher.
 */
export function evaluatePriceConfidence(opts: {
  rarity?: string;
  low?: number;
  avg?: number;
  hasExactUrl: boolean;
  hasPrice: boolean;
}): PriceEval {
  const { rarity, low, avg, hasExactUrl, hasPrice } = opts;

  if (!hasPrice) return { confidence: "unavailable", reason: "Aucune donnée de prix" };

  const special = isFullArtRarity(rarity);
  const looksTooCheap = (low ?? Infinity) < 1 || (avg ?? Infinity) < 1;

  if (special && looksTooCheap) {
    return {
      confidence: "unsafe",
      reason: "Carte spéciale renvoyant un prix plancher : liaison de variante peu fiable.",
    };
  }

  if (hasExactUrl) return { confidence: "exact" };

  return {
    confidence: "indicative",
    reason: "Donnée agrégée (TCGdex) — la variante exacte n'est pas garantie.",
  };
}

/** Valeurs de prix non-foil disponibles ? */
export function hasBasePrice(p?: CardPricing): boolean {
  return !!p && (p.low != null || p.avg != null || p.trend != null);
}

/** Le prix doit-il être affiché comme une valeur fiable ? */
export function canShowPrice(p?: CardPricing): boolean {
  return !!p && (p.confidence === "exact" || p.confidence === "variant" || p.confidence === "indicative");
}

/** Doit-on proposer "Voir sur Cardmarket" (page exacte) plutôt qu'une recherche ? */
export function hasExactLink(p?: CardPricing): boolean {
  return !!p?.sourceUrl && (p.confidence === "exact" || p.confidence === "variant");
}

/** Helper pour récupérer le lien Cardmarket à utiliser (exact sinon recherche). */
export function cardmarketLink(card: CardRecord, p?: CardPricing): string {
  if (hasExactLink(p)) return p!.sourceUrl!;
  return p?.searchUrl ?? cardmarketSearchUrl(card.name);
}
