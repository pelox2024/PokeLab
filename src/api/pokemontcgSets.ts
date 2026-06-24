/**
 * Enrichissement des extensions via pokemontcg.io : récupère la date de sortie
 * réelle (TCGdex ne la fournit pas) pour trier les sets chronologiquement.
 * Match par nom d'extension (très bien aligné entre les deux sources).
 */

interface PtcgSet {
  id: string;
  name: string;
  releaseDate?: string; // "YYYY/MM/DD"
  series?: string;
  images?: { logo?: string; symbol?: string };
}

export interface SetMeta {
  releaseDate?: string;
  series?: string;
  logo?: string;
}

let cache: Map<string, SetMeta> | null = null;

/** Map nom d'extension (minuscule) -> métadonnées (date, série, logo). */
export async function fetchPokemontcgSetMeta(): Promise<Map<string, SetMeta>> {
  if (cache) return cache;
  const map = new Map<string, SetMeta>();
  try {
    const res = await fetch(
      "https://api.pokemontcg.io/v2/sets?pageSize=400&select=id,name,releaseDate,series,images",
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: PtcgSet[] };
      for (const s of json.data ?? []) {
        map.set(s.name.toLowerCase(), {
          releaseDate: s.releaseDate,
          series: s.series,
          logo: s.images?.logo,
        });
      }
    }
  } catch {
    /* best-effort : on retombe sur le rang de série */
  }
  cache = map;
  return map;
}
