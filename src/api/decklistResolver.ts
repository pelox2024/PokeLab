import type { ParsedLine } from "../lib/deckParser";
import type { CardCategory } from "./types";

export interface ResolvedLine extends ParsedLine {
  resolved: boolean;
  cardId?: string;
  imageUrl?: string;
}

const BASE = "https://api.pokemontcg.io/v2/cards";

/** Codes PTCG Live -> ptcgoCode pokemontcg quand ils diffèrent. */
const CODE_ALIASES: Record<string, string> = {
  "PR-SV": "SVP",
  "PR-SW": "SWSHP",
  "PR-SM": "SMP",
  "PR-XY": "XYP",
};

interface PtcgCard {
  id: string;
  name: string;
  supertype?: string;
  number?: string;
  images?: { small?: string; large?: string };
}

function mapSupertype(s: string | undefined, fallback: CardCategory): CardCategory {
  if (s === "Pokémon" || s === "Pokemon") return "Pokemon";
  if (s === "Trainer") return "Trainer";
  if (s === "Energy") return "Energy";
  return fallback;
}

async function fetchSetByCode(code: string): Promise<Map<string, PtcgCard>> {
  const map = new Map<string, PtcgCard>();
  const ptcgo = CODE_ALIASES[code] ?? code;
  try {
    const res = await fetch(
      `${BASE}?q=set.ptcgoCode:${encodeURIComponent(ptcgo)}&pageSize=250&select=id,name,supertype,number,images`,
    );
    if (!res.ok) return map;
    const json = (await res.json()) as { data?: PtcgCard[] };
    for (const c of json.data ?? []) if (c.number) map.set(String(c.number), c);
  } catch {
    /* best-effort */
  }
  return map;
}

/**
 * Résout les lignes d'une decklist en cartes (nom, catégorie, image) via
 * pokemontcg.io, en groupant par code de set (≈1 requête par set).
 * Les lignes non résolues restent (cartes manuelles) — aucune perte.
 */
export async function resolveDecklist(lines: ParsedLine[]): Promise<ResolvedLine[]> {
  const codes = [...new Set(lines.map((l) => l.setCode).filter((c): c is string => !!c))];
  const setMaps = new Map<string, Map<string, PtcgCard>>();
  await Promise.all(codes.map(async (code) => setMaps.set(code, await fetchSetByCode(code))));

  return lines.map((l) => {
    if (l.setCode && l.number) {
      const card = setMaps.get(l.setCode)?.get(String(l.number));
      if (card) {
        return {
          ...l,
          name: card.name,
          category: mapSupertype(card.supertype, l.category),
          resolved: true,
          cardId: `ptcg:${card.id}`,
          imageUrl: card.images?.small ?? card.images?.large,
        };
      }
    }
    return { ...l, resolved: false };
  });
}
