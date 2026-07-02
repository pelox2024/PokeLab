import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSets } from "../hooks/useCards";
import { useCardExplorer } from "../hooks/useCardExplorer";
import { adjustOwned, useOwnedMap } from "../db/collection";
import { parseCardId } from "../lib/cardSort";
import { useDebounce } from "../lib/useDebounce";
import { fr } from "../lib/i18n";
import { CardGrid } from "../components/CardGrid";
import type { GridSize } from "../components/CardGrid";
import { FilterBar } from "../components/FilterBar";
import { CardDetailModal } from "../components/CardDetailModal";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Segmented } from "../components/ui/Segmented";
import { Icon } from "../components/ui/Icon";
import { ScrollTop } from "../components/ui/ScrollTop";
import type { CardFilters, SortKey } from "../api/types";
import styles from "./Cards.module.css";

const DENSITY_OPTIONS: { value: GridSize; label: string }[] = [
  { value: "compact", label: fr.cards.densityCompact },
  { value: "normal", label: fr.cards.densityNormal },
  { value: "large", label: fr.cards.densityLarge },
];

export function Cards() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("set-recent");
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState<GridSize>("normal");

  const debounced = useDebounce(search, 350);
  const { data: sets } = useSets();
  const owned = useOwnedMap();
  const ownedIds = useMemo(() => new Set(owned.keys()), [owned]);

  // On retire ownedOnly des filtres API (filtre client) pour éviter tout refetch.
  const apiFilters = useMemo(() => {
    if (!filters.ownedOnly) return filters;
    const copy = { ...filters };
    delete copy.ownedOnly;
    return copy;
  }, [filters]);

  const { binderMode, sections, flatCards, count, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useCardExplorer(debounced, apiFilters, sort, sets, { excludePocket: true, ownedOnly: filters.ownedOnly, ownedIds });

  const loading = isLoading;
  const showResults = !loading && !isError && count > 0;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.titleIcon}>
            <Icon name="cards" size={22} />
          </span>
          <div>
            <h1 className={styles.title}>{fr.cards.title}</h1>
            <p className={styles.subtitle}>{fr.cards.subtitle}</p>
          </div>
        </div>
        <div className={styles.heroRight}>
          <Link to="/builder" className={styles.heroCta}>
            <Icon name="builder" size={16} />
            {fr.cards.openBuilder}
          </Link>
        </div>
      </header>

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
        resultCount={count}
        hasMore={hasNextPage}
        search={search}
        onSearchChange={setSearch}
        mobileBottomBar
      />

      {showResults && (
        <div className={styles.resultBar}>
          <div className={styles.resultInfo}>
            <span className={styles.count}>{fr.cards.shown(count)}</span>
            {hasNextPage && <span className={styles.scrollHint}>· {fr.cards.scrollMore}</span>}
          </div>
          <div className={styles.density}>
            <span className={styles.densityLabel}>{fr.cards.density}</span>
            <Segmented options={DENSITY_OPTIONS} value={size} onChange={setSize} ariaLabel={fr.cards.density} />
          </div>
        </div>
      )}

      {isError ? (
        <EmptyState
          tone="danger"
          icon={<Icon name="alert" size={26} />}
          title={fr.states.errorTitle}
          body={fr.states.errorBody}
          action={
            <Button variant="ghost" onClick={refetch}>
              {fr.states.retry}
            </Button>
          }
        />
      ) : loading ? (
        <CardGrid cards={[]} skeletonCount={24} size={size} />
      ) : count === 0 && !hasNextPage ? (
        <EmptyState icon={<Icon name="empty" size={26} />} title={fr.states.emptyTitle} body={fr.states.emptyBody} />
      ) : (
        <CardGrid
          cards={binderMode ? undefined : flatCards}
          sections={binderMode ? sections : undefined}
          size={size}
          rarityHint={filters.rarities}
          getOwned={(c) => owned.get(c.id) ?? 0}
          onOwnAdjust={(c, delta) =>
            adjustOwned(
              { cardId: c.id, name: c.name, setCode: parseCardId(c.providerId).setId, number: c.localId, imageUrl: c.imageUrl },
              delta,
            )
          }
          onCardClick={(c) => setSelected(c.id)}
          loadingMore={isFetchingNextPage || (count === 0 && hasNextPage)}
          onReachEnd={fetchNextPage}
        />
      )}

      <CardDetailModal
        providerId={selected}
        onClose={() => setSelected(null)}
        onSelectCard={(id) => setSelected(id)}
      />
      <ScrollTop />
    </div>
  );
}
