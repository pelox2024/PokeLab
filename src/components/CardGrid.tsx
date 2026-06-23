import { useEffect, useRef } from "react";
import type { CardBrief } from "../api/types";
import { CardTile } from "./CardTile";
import { Skeleton } from "./ui/Skeleton";
import styles from "./CardGrid.module.css";

interface CardGridProps {
  cards: CardBrief[];
  onCardClick?: (card: CardBrief) => void;
  loadingMore?: boolean;
  onReachEnd?: () => void;
  /** Affiche des skeletons (premier chargement). */
  skeletonCount?: number;
}

export function CardGrid({
  cards,
  onCardClick,
  loadingMore,
  onReachEnd,
  skeletonCount = 0,
}: CardGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onReachEnd) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onReachEnd();
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onReachEnd]);

  if (skeletonCount > 0) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className={styles.skelTile}>
            <Skeleton height="100%" radius="var(--radius-md)" className={styles.skelImg} />
            <Skeleton width="70%" height="12px" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={styles.grid}>
        {cards.map((card) => (
          <CardTile key={card.id} card={card} onClick={onCardClick} />
        ))}
      </div>
      {loadingMore && (
        <div className={styles.grid} style={{ marginTop: 18 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skelTile}>
              <Skeleton height="100%" radius="var(--radius-md)" className={styles.skelImg} />
              <Skeleton width="70%" height="12px" />
            </div>
          ))}
        </div>
      )}
      <div ref={sentinelRef} className={styles.sentinel} />
    </>
  );
}
