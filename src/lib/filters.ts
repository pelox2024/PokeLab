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

export interface SubtypeOption {
  value: string; // clé UI (mappée côté provider)
  label: string;
}

export const SUBTYPES: SubtypeOption[] = [
  { value: "Basic", label: "Basic" },
  { value: "Stage1", label: "Niveau 1" },
  { value: "Stage2", label: "Niveau 2" },
  { value: "ex", label: "ex" },
  { value: "Item", label: "Objet" },
  { value: "Supporter", label: "Supporter" },
  { value: "Stadium", label: "Stade" },
  { value: "Tool", label: "Outil" },
  { value: "SpecialEnergy", label: "Énergie spéciale" },
];

/** Raretés les plus utiles en chips (liste courte, pas exhaustive). */
export const RARITIES: string[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Double rare",
  "Ultra Rare",
  "Illustration rare",
  "Special illustration rare",
  "Hyper rare",
];

/** Regulation marks récentes (Standard tourne autour de G/H/I). */
export const REGULATION_MARKS: string[] = ["F", "G", "H", "I"];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Nom A–Z" },
  { value: "name-desc", label: "Nom Z–A" },
];
