import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCardSearch, useSets } from "../hooks/useCards";
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
import type { CardBrief, CardFilters, SortKey } from "../api/types";
import styles from "./Cards.module.css";

const DENSITY_OPTIONS: { value: GridSize; label: string }[] = [
  { value: "compact", label: fr.cards.densityCompact },
  { value: "normal", label: fr.cards.densityNormal },
  { value: "large", label: fr.cards.densityLarge },
];

export function Cards() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState<GridSize>("normal");

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

  const showResults = !isLoading && !isError && cards.length > 0;

  return (
    <div className={styles.page}>
      {/* Hero compact */}
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
          {showResults && (
            <div className={styles.countStat}>
              <span className={styles.countNum}>{cards.length.toLocaleString("fr-FR")}</span>
              <span className={styles.countLabel}>cartes affichées</span>
            </div>
          )}
          <Link to="/builder" className={styles.heroCta}>
            <Icon name="builder" size={16} />
            {fr.cards.openBuilder}
          </Link>
        </div>
      </header>

      {/* Recherche */}
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

      {/* Barre de résultats + densité */}
      {showResults && (
        <div className={styles.resultBar}>
          <div className={styles.resultInfo}>
            {hasNextPage && <span className={styles.scrollHint}>{fr.cards.scrollMore}</span>}
          </div>
          <div className={styles.density}>
            <span className={styles.densityLabel}>{fr.cards.density}</span>
            <Segmented
              options={DENSITY_OPTIONS}
              value={size}
              onChange={setSize}
              ariaLabel={fr.cards.density}
            />
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
            <Button variant="ghost" onClick={() => refetch()}>
              {fr.states.retry}
            </Button>
          }
        />
      ) : isLoading ? (
        <CardGrid cards={[]} skeletonCount={24} size={size} />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<Icon name="empty" size={26} />}
          title={fr.states.emptyTitle}
          body={fr.states.emptyBody}
        />
      ) : (
        <CardGrid
          cards={cards}
          size={size}
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
