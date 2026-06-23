import { useMemo, useState } from "react";
import { useCardSearch, useSets } from "../hooks/useCards";
import { useDebounce } from "../lib/useDebounce";
import { fr } from "../lib/i18n";
import { CardGrid } from "../components/CardGrid";
import { FilterBar } from "../components/FilterBar";
import { CardDetailModal } from "../components/CardDetailModal";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import type { CardBrief, CardFilters, SortKey } from "../api/types";
import styles from "./Cards.module.css";

export function Cards() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [selected, setSelected] = useState<string | null>(null);

  const debounced = useDebounce(search, 350);
  const { data: sets } = useSets();

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCardSearch(debounced, filters, sort);

  const cards: CardBrief[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>
            <Icon name="cards" size={22} />
          </span>
          <div>
            <h1 className={styles.title}>{fr.cards.title}</h1>
            <p className={styles.subtitle}>{fr.cards.subtitle}</p>
          </div>
        </div>

        <div className={styles.searchRow}>
          <Input
            sizeVariant="lg"
            iconLeft={<Icon name="search" size={20} />}
            placeholder={fr.cards.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          sets={sets}
        />

        {!isLoading && !isError && cards.length > 0 && (
          <div className={styles.countRow}>
            <span className={styles.count}>{fr.cards.shown(cards.length)}</span>
            {hasNextPage && <span className={styles.more}>· {fr.cards.scrollMore}</span>}
          </div>
        )}
      </header>

      {isError ? (
        <EmptyState
          tone="danger"
          icon={<Icon name="alert" size={26} />}
          title={fr.states.errorTitle}
          body={fr.states.errorBody}
          action={
            <Button variant="ghost" onClick={() => refetch()}>
              {fr.states.retry}
            </Button>
          }
        />
      ) : isLoading ? (
        <CardGrid cards={[]} skeletonCount={24} />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<Icon name="empty" size={26} />}
          title={fr.states.emptyTitle}
          body={fr.states.emptyBody}
        />
      ) : (
        <CardGrid
          cards={cards}
          onCardClick={(c) => setSelected(c.providerId)}
          loadingMore={isFetchingNextPage}
          onReachEnd={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
        />
      )}

      <CardDetailModal providerId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
