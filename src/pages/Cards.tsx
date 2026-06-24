import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCardBrowse, useCardSearch, useSets } from "../hooks/useCards";
import { useDebounce } from "../lib/useDebounce";
import { buildSetRankMap, orderSetsByRecency, parseCardId, sortCards } from "../lib/cardSort";
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

export function Cards() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("set-recent");
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState<GridSize>("normal");

  const debounced = useDebounce(search, 350);
  const { data: sets } = useSets();

  // Mode "classeur" (set par set, ordre set récent->ancien + numéro). Marche
  // aussi avec filtres : chaque set est requêté avec les filtres (chargement
  // par lots pour traverser vite les sets sans correspondance).
  const binderMode = !debounced.trim() && (sort === "set-recent" || sort === "set-old");

  // Cartes Pokémon TCG Pocket (jeu digital, série "tcgp") : exclues par défaut
  // du vrai JCC. Distinctes du reste, réactivables via le filtre dédié.
  const pocketSetIds = useMemo(
    () => new Set((sets ?? []).filter((s) => s.seriesId === "tcgp").map((s) => s.id)),
    [sets],
  );
  const isPocket = (providerId: string) => pocketSetIds.has(parseCardId(providerId).setId);
  // On exclut Pocket sauf si l'utilisateur l'inclut OU choisit explicitement un set.
  const excludePocket = !filters.includePocket && !filters.set;

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

  // Données aplaties (mode recherche) ou en sections (mode classeur)
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
        search={search}
        onSearchChange={setSearch}
        mobileBottomBar
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
      ) : count === 0 && !q.hasNextPage ? (
        <EmptyState icon={<Icon name="empty" size={26} />} title={fr.states.emptyTitle} body={fr.states.emptyBody} />
      ) : (
        <CardGrid
          cards={binderMode ? undefined : flatCards}
          sections={binderMode ? sections : undefined}
          size={size}
          rarityHint={filters.rarities}
          onCardClick={(c) => setSelected(c.providerId)}
          loadingMore={q.isFetchingNextPage || (count === 0 && q.hasNextPage)}
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
