/**
 * Façade API : point d'entrée unique pour le reste de l'app.
 * On peut changer de provider ici sans toucher aux composants.
 */

import { tcgdexProvider, setCardLang } from "./tcgdexProvider";
import type { CardProvider } from "./types";

export const activeProvider: CardProvider = tcgdexProvider;

export { setCardLang };
export type {
  CardRecord,
  CardBrief,
  CardPage,
  CardQuery,
  SetInfo,
  CardCategory,
} from "./types";
