import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { activeProvider } from "../api/cardApi";
import type { CardPage } from "../api/types";

const PAGE_SIZE = 40;

/**
 * Recherche paginée (infinite scroll) des cartes.
 * La requête est conservée en cache par TanStack Query.
 */
export function useCardSearch(search: string) {
  return useInfiniteQuery<CardPage>({
    queryKey: ["cards", "search", search],
    queryFn: ({ pageParam }) =>
      activeProvider.searchCards({
        search,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });
}

/** Détail d'une carte (chargé à l'ouverture du modal — lazy). */
export function useCardDetail(providerId: string | null) {
  return useQuery({
    queryKey: ["cards", "detail", providerId],
    queryFn: () => activeProvider.getCard(providerId as string),
    enabled: !!providerId,
    staleTime: 30 * 60 * 1000,
  });
}
