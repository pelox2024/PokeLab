import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { activeProvider } from "../api/cardApi";
import type { CardBrief, CardFilters, CardRecord, SortKey } from "../api/types";
import type { DeckFormat } from "../db/schema";
import { useSets } from "../hooks/useCards";
import { useCardExplorer } from "../hooks/useCardExplorer";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useDebounce } from "../lib/useDebounce";
import { createDeck, persistDeck } from "../db/decks";
import { useDeckStore } from "../store/deckStore";
import { fr } from "../lib/i18n";
import { CardGrid } from "../components/CardGrid";
import { FilterBar } from "../components/FilterBar";
import { DeckPanel } from "../components/DeckPanel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { BottomSheet } from "../components/ui/BottomSheet";
import { Icon } from "../components/ui/Icon";
import styles from "./Builder.module.css";

const FORMAT_OPTIONS = [
  { value: "standard", label: fr.format.standard },
  { value: "expanded", label: fr.format.expanded },
  { value: "unlimited", label: fr.format.unlimited },
];

export function Builder() {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 980px)");

  const { deckId, versionId, name, format, cards, load, setName, setFormat, add, enrich, clearCards } =
    useDeckStore();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("set-recent");
  const [drawer, setDrawer] = useState(false);

  const debounced = useDebounce(search, 350);
  const { data: sets } = useSets();
  const { binderMode, sections, flatCards, count, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCardExplorer(debounced, filters, sort, sets, { excludePocket: true });

  const qtyByCard = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) m.set(c.cardId ?? c.id, c.quantity);
    return m;
  }, [cards]);

  // Auto-sauvegarde locale (debounced)
  useEffect(() => {
    if (!deckId || !versionId) return;
    const t = setTimeout(() => {
      void persistDeck(deckId, versionId, name, format, cards);
    }, 600);
    return () => clearTimeout(t);
  }, [deckId, versionId, name, format, cards]);

  const addToDeck = async (brief: CardBrief) => {
    add({ cardId: brief.id, name: brief.name, number: brief.localId, imageUrl: brief.imageUrl });
    try {
      const rec = await queryClient.fetchQuery<CardRecord>({
        queryKey: ["cards", "detail", brief.providerId],
        queryFn: () => activeProvider.getCard(brief.providerId),
        staleTime: 30 * 60 * 1000,
      });
      enrich(brief.id, {
        category: rec.category,
        setCode: rec.setId,
        number: rec.number,
        rarity: rec.rarity,
        subtypes: rec.subtypes,
        suffix: rec.suffix,
        hp: rec.hp,
        types: rec.types,
        imageUrl: rec.imageUrl ?? brief.imageUrl,
      });
    } catch {
      /* enrichissement best-effort */
    }
  };

  const newDeck = async () => {
    const { deck, version } = await createDeck();
    load({ deckId: deck.id, versionId: version.id, name: deck.name, format: deck.format, cards: [] });
  };

  if (!deckId) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<Icon name="builder" size={26} />}
          title={fr.builder.noDeckTitle}
          body={fr.builder.noDeckBody}
          action={
            <Button variant="primary" onClick={newDeck} iconLeft={<Icon name="plus" size={16} />}>
              {fr.builder.create}
            </Button>
          }
        />
      </div>
    );
  }

  const explorer = (
    <div className={styles.explorer}>
      <Input
        sizeVariant="lg"
        iconLeft={<Icon name="search" size={20} />}
        placeholder={fr.cards.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        sets={sets}
        resultCount={count}
        hasMore={hasNextPage}
      />
      {isError ? (
        <EmptyState tone="danger" icon={<Icon name="alert" size={26} />} title={fr.states.errorTitle} body={fr.states.errorBody} />
      ) : isLoading ? (
        <CardGrid cards={[]} skeletonCount={18} size="compact" />
      ) : count === 0 && !hasNextPage ? (
        <EmptyState icon={<Icon name="empty" size={26} />} title={fr.states.emptyTitle} body={fr.states.emptyBody} />
      ) : (
        <CardGrid
          cards={binderMode ? undefined : flatCards}
          sections={binderMode ? sections : undefined}
          size="compact"
          rarityHint={filters.rarities}
          getQty={(c) => qtyByCard.get(c.id) ?? 0}
          onCardClick={addToDeck}
          loadingMore={isFetchingNextPage || (count === 0 && hasNextPage)}
          onReachEnd={fetchNextPage}
        />
      )}
    </div>
  );

  const deckHeader = (
    <header className={styles.deckHeader}>
      <Input className={styles.nameInput} value={name} onChange={(e) => setName(e.target.value)} aria-label={fr.builder.deckName} />
      <Select options={FORMAT_OPTIONS} value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)} aria-label={fr.builder.format} />
      <Button variant="ghost" size="md" onClick={newDeck} iconLeft={<Icon name="plus" size={16} />}>
        {fr.builder.newDeck}
      </Button>
    </header>
  );

  // --- Mobile : deck-first (le deck est l'écran principal) ---
  if (isMobile) {
    return (
      <div className={styles.page}>
        {deckHeader}
        <div className={styles.deckMain}>
          <DeckPanel embedded />
        </div>
        <div className={styles.addBar}>
          {cards.length > 0 && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => confirm("Vider le deck ?") && clearCards()}
              aria-label={fr.builder.clear}
            >
              <Icon name="close" size={18} />
            </button>
          )}
          <button type="button" className={styles.addBtn} onClick={() => setDrawer(true)}>
            <Icon name="plus" size={18} />
            {fr.builder.addCards}
          </button>
        </div>
        <BottomSheet open={drawer} onClose={() => setDrawer(false)} title={fr.builder.addCards}>
          {explorer}
        </BottomSheet>
      </div>
    );
  }

  // --- Desktop : explorer + deck panel ---
  return (
    <div className={styles.page}>
      {deckHeader}
      <div className={styles.layout}>
        {explorer}
        <aside className={styles.aside}>
          <DeckPanel />
        </aside>
      </div>
    </div>
  );
}
