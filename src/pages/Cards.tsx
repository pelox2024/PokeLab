import { useMemo, useState } from "react";
import { useCardSearch } from "../hooks/useCards";
import { useDebounce } from "../lib/useDebounce";
import { fr } from "../lib/i18n";
import { CardGrid } from "../components/CardGrid";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import type { CardBrief } from "../api/types";
import styles from "./Cards.module.css";

export function Cards() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 350);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCardSearch(debounced);

  const cards: CardBrief[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const handleCardClick = (card: CardBrief) => {
    // Le modal détail arrive au lot 2 ; on log pour l'instant.
    console.info("Carte sélectionnée:", card.name, card.providerId);
  };

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
          <Button variant="ghost" size="md" iconLeft={<Icon name="sort" size={18} />}>
            Trier
          </Button>
        </div>

        {!isLoading && !isError && cards.length > 0 && (
          <div className={styles.countRow}>
            <span className={styles.count}>{fr.cards.resultsCount(cards.length)}</span>
            {hasNextPage && <span className={styles.more}>· faites défiler pour en voir plus</span>}
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
          onCardClick={handleCardClick}
          loadingMore={isFetchingNextPage}
          onReachEnd={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
        />
      )}
    </div>
  );
}
