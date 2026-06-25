/**
 * Enrichissement des cartes d'un deck (PV / types / sous-types / suffixe…),
 * indépendant du provider. Utilisé au chargement d'un deck pour garantir des
 * statistiques correctes, avec une concurrence limitée pour éviter les échecs
 * dus aux requêtes massives en parallèle.
 */
import { activeProvider } from "./cardApi";
import type { CardCategory } from "./types";
import type { DeckCard } from "../db/schema";

const PTCG = "https://api.pokemontcg.io/v2/cards";

/** Normalise les sous-types pokemontcg vers notre modèle (stage + suffix). */
function normalizePtcg(subtypes?: string[]): { subtypes: string[]; suffix?: string } {
  const out: string[] = [];
  let suffix: string | undefined;
  for (const s of subtypes ?? []) {
    switch (s) {
      case "Stage 1": out.push("Stage1"); break;
      case "Stage 2": out.push("Stage2"); break;
      case "Pokémon Tool":
      case "Pokemon Tool": out.push("Tool"); break;
      case "ex":
      case "EX": suffix = "ex"; break;
      case "V": suffix = "V"; break;
      default: out.push(s);
    }
  }
  return { subtypes: out, suffix };
}

function ptcgCategory(s: string | undefined): CardCategory {
  if (s === "Pokémon" || s === "Pokemon") return "Pokemon";
  if (s === "Trainer") return "Trainer";
  if (s === "Energy") return "Energy";
  return "Unknown";
}

/** Récupère un patch d'enrichissement pour une carte (par son id global). */
export async function fetchEnrichment(cardId: string): Promise<Partial<DeckCard> | null> {
  if (cardId.startsWith("tcgdex:")) {
    try {
      const rec = await activeProvider.getCard(cardId.slice("tcgdex:".length));
      return {
        category: rec.category,
        setCode: rec.setId,
        number: rec.number,
        rarity: rec.rarity,
        subtypes: rec.subtypes,
        suffix: rec.suffix,
        hp: rec.hp,
        types: rec.types,
      };
    } catch {
      return null;
    }
  }
  if (cardId.startsWith("ptcg:")) {
    try {
      const id = cardId.slice("ptcg:".length);
      const res = await fetch(`${PTCG}/${encodeURIComponent(id)}?select=id,supertype,subtypes,hp,types,number,rarity`);
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { supertype?: string; subtypes?: string[]; hp?: string; types?: string[]; number?: string; rarity?: string } };
      const c = json.data;
      if (!c) return null;
      const norm = normalizePtcg(c.subtypes);
      const hp = c.hp ? parseInt(c.hp, 10) : NaN;
      return {
        category: ptcgCategory(c.supertype),
        number: c.number,
        rarity: c.rarity,
        subtypes: norm.subtypes,
        suffix: norm.suffix,
        hp: Number.isNaN(hp) ? undefined : hp,
        types: c.types,
      };
    } catch {
      return null;
    }
  }
  return null;
}

/** Exécute `fn` sur `items` avec une concurrence maximale `limit`. */
export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/** Une carte a-t-elle besoin d'être (ré)enrichie pour des stats correctes ? */
export function needsEnrichment(c: DeckCard): boolean {
  if (!c.cardId) return false;
  if (c.subtypes === undefined) return true;
  if (c.category === "Pokemon" && c.hp == null) return true;
  return false;
}
