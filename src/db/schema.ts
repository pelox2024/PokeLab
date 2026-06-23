/**
 * Modèles de persistance locale (voir §11 du brief).
 * Utilisés à partir de la Phase 2 (Builder + sauvegarde locale).
 * Définis dès maintenant pour figer la structure.
 */

import type { CardCategory } from "../api/types";

export type DeckFormat = "standard" | "expanded" | "unlimited";

export interface DeckCard {
  id: string;
  cardId?: string; // référence vers une CardRecord (provider:providerId)
  name: string;
  quantity: number;
  category: CardCategory;
  setCode?: string;
  number?: string;
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
