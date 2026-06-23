import type { CardPricing, CardRecord, CardVariants, FoilStyle } from "../api/types";

/* ============================================================
   Détection des raretés
   ============================================================ */

/** Raretés "pleine carte" (full art / SIR / hyper / rainbow / chase…). */
const FULL_CARD_RARITY_PATTERNS: RegExp[] = [
  /illustration rare/i, // "Illustration rare" + "Special illustration rare"
  /special art/i,
  /\bart rare\b/i,
  /hyper/i,
  /secret/i,
  /rainbow/i,
  /gold/i,
  /black\s*&?\s*white rare/i, // "Black White Rare"
  /white flare/i,
  /black bolt/i,
  /shiny ultra/i,
  /shiny rare/i,
  /trainer gallery/i,
  /galarian gallery/i,
  /crown/i,
  /amazing/i,
  /ultra rare/i, // modern: full-art V / VMAX / supporters
  /\bSAR\b/,
  /\bSIR\b/,
  /\bCHR\b/,
  /\bCSR\b/,
  /\bAR\b/,
];

/** Raretés "holo classique" : brillance dans la zone d'illustration. */
const ARTBOX_HOLO_RARITY_PATTERNS: RegExp[] = [
  /rare holo/i,
  /\bholo\b/i,
  /double rare/i,
  /radiant/i,
  /prism/i,
  /prime/i,
];

/** Suffixes Pokémon modernes qui sont généralement holo (mais pas full-art). */
const HOLO_SUFFIX = /^(ex|gx|v|vmax|vstar|v-union)$/i;

export function isFullArtRarity(rarity?: string): boolean {
  if (!rarity) return false;
  return FULL_CARD_RARITY_PATTERNS.some((re) => re.test(rarity));
}

function isArtboxHoloRarity(rarity?: string): boolean {
  if (!rarity) return false;
  return ARTBOX_HOLO_RARITY_PATTERNS.some((re) => re.test(rarity));
}

/** Raretés considérées comme "spéciales" (un effet foil est pertinent). */
export function isSpecialRarity(rarity?: string): boolean {
  return isFullArtRarity(rarity) || isArtboxHoloRarity(rarity);
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

/** Style de foil de base (compat héritée). */
export function resolveFoilStyle(opts: {
  foil?: string | null;
  rarity?: string;
  variants?: CardVariants;
}): { foilStyle: FoilStyle; hasFoilEffect: boolean } {
  const { foil, rarity, variants } = opts;
  if (foil && KNOWN_FOIL_STYLES.has(foil as FoilStyle)) {
    return { foilStyle: foil as FoilStyle, hasFoilEffect: true };
  }
  if (isFullArtRarity(rarity)) {
    const style: FoilStyle = /rainbow|gold|secret|hyper/i.test(rarity ?? "") ? "rainbow" : "holo";
    return { foilStyle: style, hasFoilEffect: true };
  }
  if (variants?.holo || isArtboxHoloRarity(rarity)) {
    return { foilStyle: "holo", hasFoilEffect: true };
  }
  if (variants?.reverse) {
    return { foilStyle: "reverse", hasFoilEffect: true };
  }
  return { foilStyle: "none", hasFoilEffect: false };
}

/* ============================================================
   Layouts d'artbox (géométrie de la zone d'illustration)
   ============================================================ */

export type CardLayout = "modern-pokemon" | "legacy-pokemon" | "trainer" | "full-art";

export interface LayoutDims {
  top: string;
  left: string;
  right: string;
  height: string;
}

export const CARD_LAYOUTS: Record<CardLayout, LayoutDims> = {
  "modern-pokemon": { top: "14%", left: "7%", right: "7%", height: "36%" },
  "legacy-pokemon": { top: "13%", left: "8%", right: "8%", height: "34%" },
  trainer: { top: "12%", left: "7%", right: "7%", height: "45%" },
  "full-art": { top: "0%", left: "0%", right: "0%", height: "100%" },
};

export function getLayoutDims(layout: CardLayout): LayoutDims {
  return CARD_LAYOUTS[layout];
}

/* ============================================================
   Traitement visuel d'une carte
   ============================================================ */

export type FoilZone = "none" | "artbox" | "reverse" | "full";

export interface CardVisualTreatment {
  foilZone: FoilZone;
  foilStyle: FoilStyle;
  layout: CardLayout;
  confidence: "low" | "medium" | "high";
  reason?: string;
}

type VisualInput = Partial<
  Pick<CardRecord, "rarity" | "variants" | "suffix" | "foil" | "category" | "regulationMark">
> & { name?: string; displayName?: string };

function pickLayout(card: VisualInput, full: boolean): CardLayout {
  if (full) return "full-art";
  if (card.category === "Trainer") return "trainer";
  // Heuristique moderne vs ancien : le regulation mark n'existe que depuis ~2019.
  if (card.category === "Pokemon") {
    return card.regulationMark ? "modern-pokemon" : "legacy-pokemon";
  }
  return "modern-pokemon";
}

/**
 * Détermine où et comment appliquer la brillance d'une carte.
 * Tolère des données partielles : sans rareté/variants (grille), la confiance
 * tombe à "low" et aucun effet précis n'est appliqué.
 */
export function getCardVisualTreatment(card: VisualInput): CardVisualTreatment {
  const hasData = !!card.rarity || !!card.variants || !!card.foil;

  // Grille (brief) : données insuffisantes -> pas d'effet précis.
  if (!hasData) {
    return {
      foilZone: "none",
      foilStyle: "none",
      layout: "modern-pokemon",
      confidence: "low",
      reason: "Données insuffisantes (brief)",
    };
  }

  // 1) Full-card (full art / SIR / hyper / rainbow / black-white rare…)
  if (isFullArtRarity(card.rarity)) {
    const style: FoilStyle = /rainbow|gold|secret|hyper/i.test(card.rarity ?? "")
      ? "rainbow"
      : "holo";
    return {
      foilZone: "full",
      foilStyle: style,
      layout: "full-art",
      confidence: "high",
      reason: `Rareté full-card: ${card.rarity}`,
    };
  }

  // 2) Foil exotique connu (cosmos, galaxy…) -> pleine carte
  if (card.foil && KNOWN_FOIL_STYLES.has(card.foil as FoilStyle)) {
    return {
      foilZone: "full",
      foilStyle: card.foil as FoilStyle,
      layout: "full-art",
      confidence: "high",
      reason: `Foil: ${card.foil}`,
    };
  }

  // 3) Holo classique -> zone d'illustration
  const suffixHolo = card.suffix ? HOLO_SUFFIX.test(card.suffix) : false;
  if (card.variants?.holo || isArtboxHoloRarity(card.rarity) || suffixHolo) {
    return {
      foilZone: "artbox",
      foilStyle: "holo",
      layout: pickLayout(card, false),
      confidence: "high",
      reason: card.variants?.holo
        ? "variants.holo"
        : suffixHolo
          ? `Suffixe ${card.suffix}`
          : `Rareté holo: ${card.rarity}`,
    };
  }

  // 4) Reverse holo -> pourtour, hors illustration
  if (card.variants?.reverse) {
    return {
      foilZone: "reverse",
      foilStyle: "reverse",
      layout: pickLayout(card, false),
      confidence: "high",
      reason: "variants.reverse",
    };
  }

  return {
    foilZone: "none",
    foilStyle: "none",
    layout: pickLayout(card, false),
    confidence: "high",
    reason: "Carte normale",
  };
}

/* ============================================================
   Prix / Cardmarket
   ============================================================ */

export function pickCardmarket(pricing?: CardPricing[]): CardPricing | undefined {
  return pricing?.find((p) => p.provider === "cardmarket");
}

/** Lien de recherche Cardmarket (pas d'API privée, juste une recherche). */
export function cardmarketSearchUrl(name: string, setName?: string): string {
  const q = setName ? `${name} ${setName}` : name;
  return `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(
    q,
  )}`;
}
