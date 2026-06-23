import type { CardVariants, FoilStyle } from "../api/types";

/** Raretés considérées comme "spéciales" (effet foil pertinent). */
export function isSpecialRarity(rarity?: string): boolean {
  if (!rarity) return false;
  return /holo|illustration|special|hyper|secret|gold|rainbow|shiny|amazing|radiant|double rare|ultra|prism|crown|trainer gallery/i.test(
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
