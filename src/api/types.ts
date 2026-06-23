/**
 * Modèles de données normalisés, indépendants du provider.
 * Quelle que soit l'API utilisée (TCGdex en V1, pokemontcg.io plus tard),
 * on mappe toujours vers ces types.
 */

export type CardCategory = "Pokemon" | "Trainer" | "Energy" | "Unknown";

export interface Attack {
  name: string;
  cost?: string[];
  damage?: string;
  effect?: string;
}

export interface Ability {
  name: string;
  type?: string;
  effect?: string;
}

export interface WeakRes {
  type: string;
  value?: string;
}

/** Carte normalisée — voir §11 du brief. */
export interface CardRecord {
  id: string; // id global (provider:providerId)
  provider: string;
  providerId: string;
  name: string;
  category: CardCategory;
  subtypes: string[];
  types: string[];
  hp?: number;
  setId?: string;
  setName?: string;
  number?: string;
  rarity?: string;
  regulationMark?: string;
  imageUrl?: string; // URL prête à l'emploi (avec qualité + extension)
  attacks?: Attack[];
  abilities?: Ability[];
  weakness?: WeakRes[];
  resistance?: WeakRes[];
  retreatCost?: number;
  legalities?: Record<string, string | boolean>;
  raw?: unknown; // payload brut du provider (debug / enrichissement futur)
}

/** Version allégée utilisée pour la grille (liste). */
export interface CardBrief {
  id: string;
  provider: string;
  providerId: string;
  name: string;
  imageUrl?: string;
  localId?: string;
}

export interface CardQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CardPage {
  items: CardBrief[];
  page: number;
  pageSize: number;
  total?: number;
  hasMore: boolean;
}

export interface SetInfo {
  id: string;
  name: string;
  cardCount?: number;
  releaseDate?: string;
  logoUrl?: string;
}

/** Contrat commun à tous les providers de cartes. */
export interface CardProvider {
  readonly id: string;
  searchCards(query: CardQuery): Promise<CardPage>;
  getCard(providerId: string): Promise<CardRecord>;
  getSets(): Promise<SetInfo[]>;
}
