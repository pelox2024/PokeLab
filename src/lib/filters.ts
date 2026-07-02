/**
 * Définitions des filtres (labels FR + valeurs API + couleurs de types).
 * Centralisé ici pour garder FilterBar léger.
 */

import type { CardCategory, SortKey } from "../api/types";

export interface CategoryOption {
  value: CardCategory;
  label: string;
}

export const CATEGORIES: CategoryOption[] = [
  { value: "Pokemon", label: "Pokémon" },
  { value: "Trainer", label: "Dresseurs" },
  { value: "Energy", label: "Énergies" },
];

export interface TypeOption {
  value: string; // valeur API TCGdex
  label: string; // FR
  color: string; // var(--type-*)
}

export const POKEMON_TYPES: TypeOption[] = [
  { value: "Grass", label: "Plante", color: "var(--type-grass)" },
  { value: "Fire", label: "Feu", color: "var(--type-fire)" },
  { value: "Water", label: "Eau", color: "var(--type-water)" },
  { value: "Lightning", label: "Électrique", color: "var(--type-lightning)" },
  { value: "Psychic", label: "Psy", color: "var(--type-psychic)" },
  { value: "Fighting", label: "Combat", color: "var(--type-fighting)" },
  { value: "Darkness", label: "Obscurité", color: "var(--type-darkness)" },
  { value: "Metal", label: "Métal", color: "var(--type-metal)" },
  { value: "Dragon", label: "Dragon", color: "var(--type-dragon)" },
  { value: "Colorless", label: "Incolore", color: "var(--type-colorless)" },
];

export const TYPE_COLORS: Record<string, string> = Object.fromEntries(
  POKEMON_TYPES.map((t) => [t.value, t.color]),
);

const TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(POKEMON_TYPES.map((t) => [t.value, t.label])),
  Fairy: "Fée",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export interface SubtypeOption {
  value: string; // clé UI (mappée côté provider)
  label: string;
}

export const SUBTYPES: SubtypeOption[] = [
  { value: "Basic", label: "Basic" },
  { value: "Stage1", label: "Niveau 1" },
  { value: "Stage2", label: "Niveau 2" },
  { value: "ex", label: "ex" },
  { value: "V", label: "V" },
  { value: "VMAX", label: "VMAX" },
  { value: "VSTAR", label: "VSTAR" },
  { value: "Item", label: "Objet" },
  { value: "Supporter", label: "Supporter" },
  { value: "Stadium", label: "Stade" },
  { value: "Tool", label: "Outil" },
  { value: "SpecialEnergy", label: "Énergie spéciale" },
];

/**
 * Rôles deckbuilding (fonction de la carte) — recherchés via l'index Supabase,
 * qui pré-classe chaque carte. Permet de filtrer par « ce que fait la carte ».
 */
export interface RoleOption {
  value: string;
  label: string;
}

export const CARD_ROLES: RoleOption[] = [
  { value: "draw", label: "Pioche" },
  { value: "search-pokemon", label: "Cherche Pokémon" },
  { value: "search", label: "Recherche deck" },
  { value: "energy-accel", label: "Accél. énergie" },
  { value: "gust", label: "Gust / rappel" },
  { value: "switch", label: "Changement" },
  { value: "bench-damage", label: "Dégâts au banc" },
  { value: "spread-ability", label: "Dégâts (Talent)" },
  { value: "hand-disrupt", label: "Disruption main" },
  { value: "heal", label: "Soin" },
  { value: "protect", label: "Protection" },
  { value: "recovery", label: "Récupération" },
];

/** Mécaniques (structure de la carte) — mêmes tags que les rôles côté index. */
export const CARD_MECHANICS: RoleOption[] = [
  { value: "ability", label: "Avec Talent" },
  { value: "ex", label: "ex" },
  { value: "v", label: "V" },
  { value: "vstar", label: "VSTAR" },
  { value: "vmax", label: "VMAX" },
  { value: "tera", label: "Téra" },
  { value: "acespec", label: "ACE SPEC" },
];

/** Libellé FR d'un tag de rôle/mécanique. */
const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  [...CARD_ROLES, ...CARD_MECHANICS].map((r) => [r.value, r.label]),
);
export function roleLabel(value: string): string {
  return ROLE_LABELS[value] ?? value;
}

/**
 * Raretés réelles TCGdex (valeurs exactes vérifiées via l'API).
 * Triées du plus commun au plus rare / spécial.
 */
export const RARITIES: string[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Holo Rare",
  "Double rare",
  "Ultra Rare",
  "Illustration rare",
  "Special illustration rare",
  "Hyper rare",
  "Shiny rare",
  "Shiny Ultra Rare",
  "Radiant Rare",
  "ACE SPEC Rare",
  "Amazing Rare",
  "Black White Rare",
];

/** Regulation marks récentes (Standard tourne autour de G/H/I). */
export const REGULATION_MARKS: string[] = ["F", "G", "H", "I"];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "set-recent", label: "Set récent" },
  { value: "set-old", label: "Set ancien" },
  { value: "number-asc", label: "Numéro" },
  { value: "name-asc", label: "Nom A–Z" },
  { value: "name-desc", label: "Nom Z–A" },
];

/** Ordre des séries du plus récent au plus ancien (faute de releaseDate API). */
export const SERIES_ORDER: string[] = [
  "me",
  "sv",
  "tcgp",
  "swsh",
  "sm",
  "xy",
  "bw",
  "col",
  "hgss",
  "pl",
  "dp",
  "ecard",
  "ex",
  "pop",
  "lc",
  "neo",
  "gym",
  "base",
  "tk",
  "mc",
  "misc",
];

export function seriesRank(seriesId?: string): number {
  if (!seriesId) return SERIES_ORDER.length + 1;
  const i = SERIES_ORDER.indexOf(seriesId);
  return i === -1 ? SERIES_ORDER.length : i;
}
