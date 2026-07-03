/**
 * Base IndexedDB (Dexie) de PokéLab.
 * Schéma versionné dès la v1 pour survivre aux migrations futures.
 * Branchée à partir de la Phase 2.
 */

import Dexie from "dexie";
import type { Table } from "dexie";
import type {
  Binder,
  CachedCard,
  CollectionItem,
  Deck,
  DeckVersion,
  SavedSearch,
  WishlistItem,
} from "./schema";

export class PokeLabDB extends Dexie {
  decks!: Table<Deck, string>;
  versions!: Table<DeckVersion, string>;
  cardCache!: Table<CachedCard, string>;
  // Préparées pour les Phases 5/6/7 (non utilisées en V1).
  collection!: Table<CollectionItem, string>;
  binders!: Table<Binder, string>;
  wishlist!: Table<WishlistItem, string>;
  savedSearches!: Table<SavedSearch, string>;

  constructor() {
    super("pokelab");
    this.version(1).stores({
      decks: "id, name, format, archived, updatedAt",
      versions: "id, deckId, updatedAt",
      cardCache: "id, name, updatedAt",
    });
    // v2 : tables collection (vision compagnon). Schéma prêt, pas encore exploité.
    this.version(2).stores({
      collection: "id, cardId, setCode, variant, binderId, updatedAt",
      binders: "id, name, updatedAt",
      wishlist: "id, cardId, priority, updatedAt",
    });
    // v3 : recherches enregistrées (terme + filtres).
    this.version(3).stores({
      savedSearches: "id, name, createdAt",
    });
  }
}

export const db = new PokeLabDB();
