/**
 * Préférences utilisateur persistées (localStorage) et appliquées au provider
 * de cartes. Appelées au démarrage (initPrefs) puis depuis la page Réglages.
 */
import {
  getBilingualSearch,
  getDisplayLang,
  setBilingualSearch,
  setDisplayLang,
} from "../api/cardApi";
import type { CardLang } from "../api/types";

const LANG_KEY = "pokelab.displayLang";
const BILINGUAL_KEY = "pokelab.bilingual";

/** Applique les préférences enregistrées au chargement de l'app. */
export function initPrefs(): void {
  try {
    const lang = localStorage.getItem(LANG_KEY);
    if (lang === "fr" || lang === "en") setDisplayLang(lang);
    if (localStorage.getItem(BILINGUAL_KEY) === "0") setBilingualSearch(false);
  } catch {
    /* localStorage indisponible — on garde les valeurs par défaut */
  }
}

export function getLangPref(): CardLang {
  return getDisplayLang();
}
export function setLangPref(lang: CardLang): void {
  setDisplayLang(lang);
  localStorage.setItem(LANG_KEY, lang);
}

export function getBilingualPref(): boolean {
  return getBilingualSearch();
}
export function setBilingualPref(on: boolean): void {
  setBilingualSearch(on);
  localStorage.setItem(BILINGUAL_KEY, on ? "1" : "0");
}
