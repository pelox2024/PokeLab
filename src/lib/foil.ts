import type { CardPricing, CardRecord, CardVariants, FoilStyle } from "../api/types";

/** Raretés considérées comme "spéciales" (effet foil pertinent). */
export function isSpecialRarity(rarity?: string): boolean {
  if (!rarity) return false;
  return /holo|illustration|special|hyper|secret|gold|rainbow|shiny|amazing|radiant|double rare|ultra|prism|crown|trainer gallery/i.test(
    rarity,
  );
}

/** Raretés "pleine carte" (full art / illustration / hyper / gold / rainbow…). */
export function isFullArtRarity(rarity?: string): boolean {
  if (!rarity) return false;
  return /illustration rare|special illustration|hyper|rainbow|gold|secret|amazing|crown|trainer gallery|ultra/i.test(
    rarity,
  );
}

const KNOWN_FOIL_STYLES = new Set<FoilStyle>([
  "holo",
  "reverse",
  "cosmos",
  "galaxy",
  "cracked-ice",
  "rainbow",
  "mirror",
]);

/** Détermine le style de foil d'une carte à partir de ses données complètes. */
export function resolveFoilStyle(opts: {
  foil?: string | null;
  rarity?: string;
  variants?: CardVariants;
}): { foilStyle: FoilStyle; hasFoilEffect: boolean } {
  const { foil, rarity, variants } = opts;

  if (foil && KNOWN_FOIL_STYLES.has(foil as FoilStyle)) {
    return { foilStyle: foil as FoilStyle, hasFoilEffect: true };
  }
  if (isSpecialRarity(rarity)) {
    return { foilStyle: "holo", hasFoilEffect: true };
  }
  if (variants?.holo) {
    return { foilStyle: "holo", hasFoilEffect: true };
  }
  if (variants?.reverse) {
    return { foilStyle: "reverse", hasFoilEffect: true };
  }
  return { foilStyle: "none", hasFoilEffect: false };
}

/**
 * Heuristique pour la grille : les briefs TCGdex ne contiennent ni rareté ni
 * variants. On déduit donc un foil probable depuis le suffixe du nom
 * (ex, V, VMAX, VSTAR, GX…) — sans appel détail supplémentaire.
 */
const SPECIAL_NAME = /(\bex\b|\bGX\b|\bV\b|\bVMAX\b|\bVSTAR\b|V-UNION|\bBREAK\b|Radiant|Prime|LEGEND|\bStar\b)/;

export function inferFoilFromName(name: string): FoilStyle {
  return SPECIAL_NAME.test(name) ? "holo" : "none";
}

/* ============================================================
   Présentation du foil par ZONE (Pokémon TCG)
   - artbox  : brillance concentrée sur l'illustration (holo classique)
   - reverse : brillance autour de l'illustration, pas sur l'artwork
   - full    : brillance sur toute la carte (full art / SIR / rainbow…)
   ============================================================ */

export type FoilZone = "none" | "artbox" | "reverse" | "full";

export interface FoilPresentation {
  zone: FoilZone;
  style: FoilStyle;
}

type FoilInput = Partial<
  Pick<CardRecord, "rarity" | "variants" | "suffix" | "foil" | "category">
> & { name?: string; displayName?: string };

/** Détermine zone + style d'un effet foil. Tolère des données partielles (grille). */
export function getFoilPresentation(card: FoilInput): FoilPresentation {
  const hasDetailedData = !!card.rarity || !!card.variants || !!card.foil;

  // Grille (brief) : pas de rareté/variants -> heuristique sur le nom.
  if (!hasDetailedData) {
    const name = card.displayName || card.name || "";
    return SPECIAL_NAME.test(name)
      ? { zone: "artbox", style: "holo" }
      : { zone: "none", style: "none" };
  }

  // Full art / illustration / hyper / rainbow / gold…
  if (isFullArtRarity(card.rarity)) {
    const style: FoilStyle = /rainbow|gold|secret|hyper/i.test(card.rarity ?? "")
      ? "rainbow"
      : "holo";
    return { zone: "full", style };
  }

  // Foil "exotique" connu (cosmos, galaxy…) -> pleine carte.
  if (card.foil && KNOWN_FOIL_STYLES.has(card.foil as FoilStyle)) {
    return { zone: "full", style: card.foil as FoilStyle };
  }

  // Holo classique (double rare / ex holo / rare holo) -> zone illustration.
  if (card.variants?.holo || /holo/i.test(card.rarity ?? "")) {
    return { zone: "artbox", style: "holo" };
  }

  // Reverse holo -> pourtour, pas l'illustration.
  if (card.variants?.reverse) {
    return { zone: "reverse", style: "reverse" };
  }

  return { zone: "none", style: "none" };
}

/* ============================================================
   Prix / Cardmarket
   ============================================================ */

export function pickCardmarket(pricing?: CardPricing[]): CardPricing | undefined {
  return pricing?.find((p) => p.provider === "cardmarket");
}

/** Lien de recherche Cardmarket (pas d'API privée, juste une recherche). */
export function cardmarketSearchUrl(name: string): string {
  return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(
    name,
  )}`;
}
