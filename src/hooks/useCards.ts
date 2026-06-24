import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { activeProvider } from "../api/cardApi";
import { fetchPokemontcgPricing } from "../api/pokemontcgPricing";
import { fetchPokemontcgSetMeta } from "../api/pokemontcgSets";
import { numberKey, parseCardId } from "../lib/cardSort";
import type { CardBrief, CardFilters, CardPage, CardRecord, SetInfo, SortKey } from "../api/types";

const PAGE_SIZE = 40;

/**
 * Recherche paginée (infinite scroll) des cartes, avec filtres et tri.
 * La requête est conservée en cache par TanStack Query.
 */
export function useCardSearch(search: string, filters: CardFilters, sort: SortKey, enabled = true) {
  return useInfiniteQuery<CardPage>({
    queryKey: ["cards", "search", search, filters, sort],
    enabled,
    queryFn: ({ pageParam }) =>
      activeProvider.searchCards({
        search,
        filters,
        sort,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });
}

export interface BrowsePage {
  set: SetInfo;
  items: CardBrief[];
  index: number;
}

/**
 * Mode "classeur" : charge les cartes set par set (le plus récent d'abord),
 * triées par numéro croissant. Utilisé pour l'exploration par défaut.
 */
export function useCardBrowse(orderedSets: SetInfo[], keySig: string, enabled: boolean) {
  return useInfiniteQuery<BrowsePage>({
    queryKey: ["browse", keySig],
    enabled: enabled && orderedSets.length > 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const index = pageParam as number;
      const set = orderedSets[index];
      const page = await activeProvider.searchCards({ filters: { set: set.id }, pageSize: 600 });
      const items = [...page.items].sort(
        (a, b) => numberKey(parseCardId(a.providerId).localId) - numberKey(parseCardId(b.providerId).localId),
      );
      return { set, items, index };
    },
    getNextPageParam: (last) => (last.index + 1 < orderedSets.length ? last.index + 1 : undefined),
    staleTime: 10 * 60 * 1000,
  });
}

/** Détail d'une carte (chargé à l'ouverture du modal — lazy, bilingue). */
export function useCardDetail(providerId: string | null) {
  return useQuery({
    queryKey: ["cards", "detail", providerId],
    queryFn: () => activeProvider.getCard(providerId as string),
    enabled: !!providerId,
    staleTime: 30 * 60 * 1000,
  });
}

/** Autres impressions/versions d'une carte (même nom), pour la modal. */
export function useCardVersions(name: string | undefined) {
  return useQuery({
    queryKey: ["cards", "versions", name],
    queryFn: async () => {
      const page = await activeProvider.searchCards({ search: name, pageSize: 60 });
      const target = (name ?? "").toLowerCase();
      return page.items.filter((b) => b.name.toLowerCase() === target);
    },
    enabled: !!name,
    staleTime: 30 * 60 * 1000,
  });
}

/** Prix exact via pokemontcg.io (lazy, à l'ouverture de la modal). */
export function usePokemontcgPrice(card: CardRecord | undefined) {
  return useQuery({
    queryKey: ["price", "ptcg", card?.id],
    queryFn: () =>
      fetchPokemontcgPricing({
        name: card!.name,
        number: card!.number,
        setName: card!.setName,
      }),
    enabled: !!card,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 0,
  });
}

/** Liste des extensions (sets), enrichies avec la date de sortie réelle. */
export function useSets() {
  return useQuery({
    queryKey: ["sets"],
    queryFn: async () => {
      const [sets, meta] = await Promise.all([
        activeProvider.getSets(),
        fetchPokemontcgSetMeta(),
      ]);
      return sets.map((s) => {
        const m = meta.get(s.name.toLowerCase());
        return m?.releaseDate ? { ...s, releaseDate: m.releaseDate } : s;
      });
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}
