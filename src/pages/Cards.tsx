import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCardBrowse, useCardSearch, useSets } from "../hooks/useCards";
import { useDebounce } from "../lib/useDebounce";
import { buildSetRankMap, orderSetsByRecency, sortCards } from "../lib/cardSort";
import { fr } from "../lib/i18n";
import { CardGrid } from "../components/CardGrid";
import type { CardSection } from "../components/CardGrid";
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

function hasFacetFilters(f: CardFilters): boolean {
  return !!(
    f.categories?.length ||
    f.types?.length ||
    f.subtypes?.length ||
    f.rarities?.length ||
    f.regulationMarks?.length ||
    f.set ||
    f.standardLegal ||
    f.expandedLegal
  );
}

export function Cards() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("set-recent");
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState<GridSize>("normal");

  const debounced = useDebounce(search, 350);
  const { data: sets } = useSets();

  // Mode "classeur" : exploration pure (sans recherche ni filtre), tri par set.
  const binderMode =
    !debounced.trim() && !hasFacetFilters(filters) && (sort === "set-recent" || sort === "set-old");

  const orderedSets = useMemo(
    () => orderSetsByRecency(sets ?? [], sort !== "set-old"),
    [sets, sort],
  );
  const setRank = useMemo(() => buildSetRankMap(sets ?? []), [sets]);

  const browse = useCardBrowse(orderedSets, `${sort}:${orderedSets.length}`, binderMode);
  const flat = useCardSearch(debounced, filters, sort, !binderMode);
  const q = binderMode ? browse : flat;

  // Données aplaties (mode recherche) ou en sections (mode classeur)
  const flatCards: CardBrief[] = useMemo(() => {
    if (binderMode) return [];
    const items = flat.data?.pages.flatMap((p) => p.items) ?? [];
    return sortCards(items, sort, setRank);
  }, [binderMode, flat.data, sort, setRank]);

  const sections: CardSection[] = useMemo(() => {
    if (!binderMode) return [];
    return (browse.data?.pages ?? []).map((p) => ({
      key: p.set.id,
      title: p.set.name,
      subtitle: `${p.set.releaseDate?.slice(0, 4) ?? ""} · ${p.items.length} cartes`.trim(),
      cards: p.items,
    }));
  }, [binderMode, browse.data]);

  const count = binderMode
    ? sections.reduce((s, sec) => s + sec.cards.length, 0)
    : flatCards.length;
  const loading = q.isLoading || (binderMode && !sets);
  const showResults = !loading && !q.isError && count > 0;

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
        hasMore={q.hasNextPage}
      />

      {showResults && (
        <div className={styles.resultBar}>
          <div className={styles.resultInfo}>
            <span className={styles.count}>{fr.cards.shown(count)}</span>
            {q.hasNextPage && <span className={styles.scrollHint}>· {fr.cards.scrollMore}</span>}
          </div>
          <div className={styles.density}>
            <span className={styles.densityLabel}>{fr.cards.density}</span>
            <Segmented options={DENSITY_OPTIONS} value={size} onChange={setSize} ariaLabel={fr.cards.density} />
          </div>
        </div>
      )}

      {q.isError ? (
        <EmptyState
          tone="danger"
          icon={<Icon name="alert" size={26} />}
          title={fr.states.errorTitle}
          body={fr.states.errorBody}
          action={
            <Button variant="ghost" onClick={() => q.refetch()}>
              {fr.states.retry}
            </Button>
          }
        />
      ) : loading ? (
        <CardGrid cards={[]} skeletonCount={24} size={size} />
      ) : count === 0 ? (
        <EmptyState icon={<Icon name="empty" size={26} />} title={fr.states.emptyTitle} body={fr.states.emptyBody} />
      ) : (
        <CardGrid
          cards={binderMode ? undefined : flatCards}
          sections={binderMode ? sections : undefined}
          size={size}
          rarityHint={filters.rarities}
          onCardClick={(c) => setSelected(c.providerId)}
          loadingMore={q.isFetchingNextPage}
          onReachEnd={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
        />
      )}

      <CardDetailModal
        providerId={selected}
        onClose={() => setSelected(null)}
        onSelectCard={(id) => setSelected(id)}
      />
    </div>
  );
}
