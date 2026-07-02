import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { activeProvider } from "../api/cardApi";
import { getPtcgCard, searchCardsFullText } from "../api/ptcgProvider";
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
  // Recherche textuelle (nom OU texte des attaques/talents/règles) : index
  // Supabase (pokemontcg). Sans terme, navigation classique TCGdex par nom.
  const isTextSearch = !!search.trim();
  return useInfiniteQuery<CardPage>({
    queryKey: ["cards", "search", isTextSearch ? "ft" : "tcgdex", search, filters, sort],
    enabled,
    queryFn: ({ pageParam }) => {
      const q = { search, filters, sort, page: pageParam as number, pageSize: PAGE_SIZE };
      return isTextSearch ? searchCardsFullText(q) : activeProvider.searchCards(q);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });
}

export interface BrowseSet {
  set: SetInfo;
  items: CardBrief[];
}
export interface BrowsePage {
  sets: BrowseSet[];
  page: number;
}

const BROWSE_BATCH = 3; // sets chargés en parallèle par étape (limite le churn)

/**
 * Mode "classeur" : charge les cartes set par set (le plus récent d'abord),
 * triées par numéro croissant. Les filtres actifs s'appliquent à chaque set ;
 * on charge par lots pour traverser vite les sets sans correspondance.
 */
export function useCardBrowse(
  orderedSets: SetInfo[],
  filters: CardFilters,
  keySig: string,
  enabled: boolean,
) {
  return useInfiniteQuery<BrowsePage>({
    queryKey: ["browse", keySig],
    enabled: enabled && orderedSets.length > 0,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const slice = orderedSets.slice(page * BROWSE_BATCH, page * BROWSE_BATCH + BROWSE_BATCH);
      const sets = await Promise.all(
        slice.map(async (set) => {
          const res = await activeProvider.searchCards({
            filters: { ...filters, set: set.id },
            pageSize: 600,
          });
          const items = [...res.items].sort(
            (a, b) =>
              numberKey(parseCardId(a.providerId).localId) - numberKey(parseCardId(b.providerId).localId),
          );
          return { set, items };
        }),
      );
      return { sets, page };
    },
    getNextPageParam: (last) =>
      (last.page + 1) * BROWSE_BATCH < orderedSets.length ? last.page + 1 : undefined,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Détail d'une carte (lazy, à l'ouverture de la modal). Accepte un id global
 * préfixé (`ptcg:` / `tcgdex:`) ou un id TCGdex nu (rétro-compat) et route vers
 * le bon provider — TCGdex (bilingue) ou pokemontcg pour les cartes `ptcg:`.
 */
export function useCardDetail(id: string | null) {
  return useQuery({
    queryKey: ["cards", "detail", id],
    queryFn: () => {
      const key = id as string;
      if (key.startsWith("ptcg:")) return getPtcgCard(key.slice("ptcg:".length));
      const pid = key.startsWith("tcgdex:") ? key.slice("tcgdex:".length) : key;
      return activeProvider.getCard(pid);
    },
    enabled: !!id,
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
        if (!m) return s;
        return {
          ...s,
          releaseDate: m.releaseDate ?? s.releaseDate,
          ptcgoCode: m.ptcgoCode ?? s.ptcgoCode,
        };
      });
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}
