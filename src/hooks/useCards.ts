import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { activeProvider } from "../api/cardApi";
import type { CardFilters, CardPage, SortKey } from "../api/types";

const PAGE_SIZE = 40;

/**
 * Recherche paginée (infinite scroll) des cartes, avec filtres et tri.
 * La requête est conservée en cache par TanStack Query.
 */
export function useCardSearch(search: string, filters: CardFilters, sort: SortKey) {
  return useInfiniteQuery<CardPage>({
    queryKey: ["cards", "search", search, filters, sort],
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

/** Détail d'une carte (chargé à l'ouverture du modal — lazy, bilingue). */
export function useCardDetail(providerId: string | null) {
  return useQuery({
    queryKey: ["cards", "detail", providerId],
    queryFn: () => activeProvider.getCard(providerId as string),
    enabled: !!providerId,
    staleTime: 30 * 60 * 1000,
  });
}

/** Liste des extensions (sets) pour le filtre — cache long. */
export function useSets() {
  return useQuery({
    queryKey: ["sets"],
    queryFn: () => activeProvider.getSets(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
