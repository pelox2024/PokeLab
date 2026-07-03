/**
 * Modèles de persistance locale (voir §11 du brief).
 * Utilisés à partir de la Phase 2 (Builder + sauvegarde locale).
 * Définis dès maintenant pour figer la structure.
 */

import type { CardCategory, CardFilters } from "../api/types";

export type DeckFormat = "standard" | "expanded" | "unlimited";

/** Recherche enregistrée (terme + filtres) réappliquable en un clic. */
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: CardFilters;
  createdAt: number;
}

export interface DeckCard {
  id: string;
  cardId?: string; // référence vers une CardRecord (provider:providerId)
  name: string;
  quantity: number;
  category: CardCategory;
  setCode?: string;
  number?: string;
  imageUrl?: string;
  rarity?: string;
  subtypes?: string[]; // [stage, trainerType, energyType]
  suffix?: string; // ex, V, VMAX, VSTAR…
  hp?: number;
  types?: string[]; // types d'énergie (Pokémon)
  rawLine?: string; // ligne brute issue d'un import non résolu
  manual: boolean; // true = carte non résolue via l'API
}

export interface DeckVersion {
  id: string;
  deckId: string;
  name: string;
  cards: DeckCard[];
  notes?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  tags: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

/** Cache local d'une carte (catalogue consulté) — Phase 2+. */
export interface CachedCard {
  id: string; // provider:providerId
  name: string;
  updatedAt: number;
  data: unknown; // CardRecord sérialisé
}

/* ============================================================
   Collection — types préparés pour les Phases 5/6/7.
   (architecture seulement, pas encore de logique en V1)
   ============================================================ */

export type CardVariantKind =
  | "normal"
  | "reverse"
  | "holo"
  | "firstEdition"
  | "promo"
  | "other";

export type CardCondition =
  | "mint"
  | "nearMint"
  | "excellent"
  | "good"
  | "played"
  | "poor";

export type CardLanguage = "en" | "fr" | "de" | "it" | "ja" | "other";

export type Currency = "EUR" | "CHF" | "USD";

export interface CollectionItem {
  id: string;
  cardId?: string;
  name: string;
  setCode?: string;
  number?: string;
  imageUrl?: string;
  variant: CardVariantKind;
  quantity: number;
  language: CardLanguage;
  condition?: CardCondition;
  isGraded?: boolean;
  gradeCompany?: "PSA" | "BGS" | "CGC" | "Other";
  grade?: string;
  purchasePrice?: number;
  estimatedPrice?: number;
  currency?: Currency;
  location?: string;
  binderId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Binder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  id: string;
  cardId?: string;
  name: string;
  setCode?: string;
  number?: string;
  wantedQuantity: number;
  maxPrice?: number;
  priority: "low" | "medium" | "high";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---- Deck completion (Phase 6) ---- */

export interface MissingCard {
  cardName: string;
  setCode?: string;
  number?: string;
  neededQuantity: number;
  ownedQuantity: number;
  missingQuantity: number;
  estimatedUnitPrice?: number;
  estimatedTotalPrice?: number;
  source?: "cardmarket" | "tcgplayer" | "manual";
}

export interface DeckCompletion {
  totalCards: number;
  ownedCards: number;
  missingCards: number;
  completionPercent: number;
  estimatedMissingCost: number;
  currency: Currency;
  missingList: MissingCard[];
}
