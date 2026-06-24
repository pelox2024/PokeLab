import type { CardBrief, SetInfo, SortKey } from "../api/types";
import { seriesRank } from "./filters";

/** Décompose un providerId TCGdex (ex: "sv08-001" -> set "sv08", num "001"). */
export function parseCardId(providerId: string): { setId: string; localId: string } {
  const i = providerId.lastIndexOf("-");
  if (i === -1) return { setId: providerId, localId: "" };
  return { setId: providerId.slice(0, i), localId: providerId.slice(i + 1) };
}

/** Partie numérique d'un localId (pour trier 1,2,…,10 et pas 1,10,2). */
export function numberKey(localId: string): number {
  const n = parseInt(localId, 10);
  return Number.isNaN(n) ? 99999 : n;
}

/** Valeur de récence d'un set (plus grand = plus récent). */
export function setRecencyValue(s: SetInfo): number {
  if (s.releaseDate) {
    const t = Date.parse(s.releaseDate.replace(/\//g, "-"));
    if (!Number.isNaN(t)) return t;
  }
  // Pas de date : on classe par série (récente d'abord) puis id.
  return -seriesRank(s.seriesId) * 1e9;
}

/** Trie les sets par récence (le plus récent d'abord par défaut). */
export function orderSetsByRecency(sets: SetInfo[], recentFirst = true): SetInfo[] {
  return [...sets].sort((a, b) => {
    const d = setRecencyValue(b) - setRecencyValue(a);
    if (d !== 0) return recentFirst ? d : -d;
    return recentFirst ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
  });
}

/** Map setId -> rang de récence (0 = le plus récent). */
export function buildSetRankMap(sets: SetInfo[]): Map<string, number> {
  const ordered = orderSetsByRecency(sets, true);
  const map = new Map<string, number>();
  ordered.forEach((s, i) => map.set(s.id, i));
  return map;
}

const BIG = 1e9;

/** Tri client par set (récence) puis numéro croissant. */
export function sortCards(
  cards: CardBrief[],
  sort: SortKey,
  setRank: Map<string, number>,
): CardBrief[] {
  if (sort === "name-asc" || sort === "name-desc") return cards; // déjà trié serveur/merge

  const meta = (c: CardBrief) => {
    const { setId, localId } = parseCardId(c.providerId);
    return { rank: setRank.get(setId) ?? BIG, num: numberKey(localId), setId };
  };

  const sorted = [...cards].sort((a, b) => {
    const ma = meta(a);
    const mb = meta(b);
    if (sort === "number-asc") {
      if (ma.num !== mb.num) return ma.num - mb.num;
      return ma.rank - mb.rank;
    }
    // set-recent / set-old
    if (ma.rank !== mb.rank) return sort === "set-old" ? mb.rank - ma.rank : ma.rank - mb.rank;
    return ma.num - mb.num; // dans un set: numéro croissant
  });
  return sorted;
}
