import { useMemo } from "react";
import { useCardBrowse, useCardSearch } from "./useCards";
import { buildSetRankMap, orderSetsByRecency, parseCardId, sortCards } from "../lib/cardSort";
import type { CardBrief, CardFilters, SetInfo, SortKey } from "../api/types";
import type { CardSection } from "../components/CardGrid";

interface Options {
  /** Exclure Pokémon TCG Pocket par défaut (sauf set explicite / includePocket). */
  excludePocket?: boolean;
}

export interface CardExplorer {
  /** Mode "classeur" : navigation set par set (tri set récent/ancien, sans recherche). */
  binderMode: boolean;
  sections: CardSection[];
  flatCards: CardBrief[];
  count: number;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * Logique de navigation/recherche de cartes partagée par la page Cartes et le
 * Constructeur. Garantit un tri par set cohérent : TCGdex paginant par nom, on
 * passe en mode "classeur" (requête set par set, du plus récent au plus ancien,
 * triées par numéro) dès qu'on trie par set sans recherche active — sinon le tri
 * client ne réordonne que la tranche alphabétique déjà chargée.
 */
export function useCardExplorer(
  debounced: string,
  filters: CardFilters,
  sort: SortKey,
  sets: SetInfo[] | undefined,
  options?: Options,
): CardExplorer {
  const binderMode = !debounced.trim() && (sort === "set-recent" || sort === "set-old");

  const pocketSetIds = useMemo(
    () => new Set((sets ?? []).filter((s) => s.seriesId === "tcgp").map((s) => s.id)),
    [sets],
  );
  const isPocket = (providerId: string) => pocketSetIds.has(parseCardId(providerId).setId);
  const excludePocket = !!options?.excludePocket && !filters.includePocket && !filters.set;

  const orderedSets = useMemo(() => {
    const all = orderSetsByRecency(sets ?? [], sort !== "set-old");
    if (filters.set) return all.filter((s) => s.id === filters.set);
    return excludePocket ? all.filter((s) => s.seriesId !== "tcgp") : all;
  }, [sets, sort, filters.set, excludePocket]);
  const setRank = useMemo(() => buildSetRankMap(sets ?? []), [sets]);

  const browseKey = `${sort}:${orderedSets.length}:${JSON.stringify(filters)}`;
  const browse = useCardBrowse(orderedSets, filters, browseKey, binderMode);
  const flat = useCardSearch(debounced, filters, sort, !binderMode);
  const q = binderMode ? browse : flat;

  const flatCards: CardBrief[] = useMemo(() => {
    if (binderMode) return [];
    let items = flat.data?.pages.flatMap((p) => p.items) ?? [];
    if (excludePocket) items = items.filter((c) => !isPocket(c.providerId));
    return sortCards(items, sort, setRank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binderMode, flat.data, sort, setRank, excludePocket, pocketSetIds]);

  const sections: CardSection[] = useMemo(() => {
    if (!binderMode) return [];
    return (browse.data?.pages ?? [])
      .flatMap((p) => p.sets)
      .map(({ set, items }) => ({
        key: set.id,
        title: set.name,
        subtitle: `${set.releaseDate?.slice(0, 4) ?? ""} · ${items.length} cartes`.trim(),
        cards: items,
      }));
  }, [binderMode, browse.data]);

  const count = binderMode
    ? sections.reduce((s, sec) => s + sec.cards.length, 0)
    : flatCards.length;

  return {
    binderMode,
    sections,
    flatCards,
    count,
    isLoading: q.isLoading || (binderMode && !sets),
    isError: q.isError,
    hasNextPage: !!q.hasNextPage,
    isFetchingNextPage: q.isFetchingNextPage,
    fetchNextPage: () => {
      if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    },
    refetch: () => void q.refetch(),
  };
}
