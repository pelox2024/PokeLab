/**
 * Façade API : point d'entrée unique pour le reste de l'app.
 * On peut changer de provider ici sans toucher aux composants.
 */

import {
  tcgdexProvider,
  setCardLang,
  setDisplayLang,
  getDisplayLang,
  setBilingualSearch,
  getBilingualSearch,
} from "./tcgdexProvider";
import type { CardProvider } from "./types";

export const activeProvider: CardProvider = tcgdexProvider;

export { setCardLang, setDisplayLang, getDisplayLang, setBilingualSearch, getBilingualSearch };
export type {
  CardRecord,
  CardBrief,
  CardPage,
  CardQuery,
  CardFilters,
  SetInfo,
  CardCategory,
  CardLang,
  SortKey,
  FoilStyle,
} from "./types";
