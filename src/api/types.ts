/**
 * Modèles de données normalisés, indépendants du provider.
 * Quelle que soit l'API utilisée (TCGdex en V1, pokemontcg.io plus tard),
 * on mappe toujours vers ces types.
 */

export type CardCategory = "Pokemon" | "Trainer" | "Energy" | "Unknown";

/** Langue des données cartes. EN reste canonique (compat decklists). */
export type CardLang = "en" | "fr";

export type FoilStyle =
  | "holo"
  | "reverse"
  | "cosmos"
  | "galaxy"
  | "cracked-ice"
  | "rainbow"
  | "mirror"
  | "none";

export interface CardVariants {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
  jumbo?: boolean;
  preRelease?: boolean;
}

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
  name: string; // nom canonique (EN) — utilisé pour les decklists
  nameEn?: string;
  nameFr?: string;
  displayName: string; // nom affiché selon préférence
  category: CardCategory;
  subtypes: string[];
  suffix?: string; // ex, V, VMAX…
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
  legalities?: { standard?: boolean; expanded?: boolean };
  variants?: CardVariants;
  foil?: string;
  hasFoilEffect?: boolean;
  foilStyle?: FoilStyle;
  evolveFrom?: string;
  illustrator?: string;
  raw?: unknown; // payload brut du provider (debug / enrichissement futur)
}

/** Version allégée utilisée pour la grille (liste). */
export interface CardBrief {
  id: string;
  provider: string;
  providerId: string;
  name: string; // = displayName (compat ascendante)
  nameEn?: string;
  nameFr?: string;
  displayName: string;
  searchAliases?: string[];
  localId?: string;
  imageUrl?: string;
}

export interface CardFilters {
  category?: CardCategory;
  type?: string; // Fire, Water…
  subtype?: string; // clé UI: Basic, Stage1, ex, Item…
  set?: string; // set id
  rarity?: string;
  regulationMark?: string;
  standardLegal?: boolean;
}

export type SortKey = "name-asc" | "name-desc";

export interface CardQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  filters?: CardFilters;
  sort?: SortKey;
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
