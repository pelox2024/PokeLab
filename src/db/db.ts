/**
 * Base IndexedDB (Dexie) de PokéLab.
 * Schéma versionné dès la v1 pour survivre aux migrations futures.
 * Branchée à partir de la Phase 2.
 */

import Dexie from "dexie";
import type { Table } from "dexie";
import type { CachedCard, Deck, DeckVersion } from "./schema";

export class PokeLabDB extends Dexie {
  decks!: Table<Deck, string>;
  versions!: Table<DeckVersion, string>;
  cardCache!: Table<CachedCard, string>;

  constructor() {
    super("pokelab");
    this.version(1).stores({
      decks: "id, name, format, archived, updatedAt",
      versions: "id, deckId, updatedAt",
      cardCache: "id, name, updatedAt",
    });
  }
}

export const db = new PokeLabDB();
