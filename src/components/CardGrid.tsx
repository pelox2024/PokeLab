import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { CardBrief } from "../api/types";
import { CardTile } from "./CardTile";
import { Skeleton } from "./ui/Skeleton";
import styles from "./CardGrid.module.css";

export type GridSize = "compact" | "normal" | "large";

const COL_MIN: Record<GridSize, string> = {
  compact: "116px",
  normal: "150px",
  large: "190px",
};

interface CardGridProps {
  cards: CardBrief[];
  onCardClick?: (card: CardBrief) => void;
  loadingMore?: boolean;
  onReachEnd?: () => void;
  skeletonCount?: number;
  size?: GridSize;
  rarityHint?: string[];
  getQty?: (card: CardBrief) => number;
}

export function CardGrid({
  cards,
  onCardClick,
  loadingMore,
  onReachEnd,
  skeletonCount = 0,
  size = "normal",
  rarityHint,
  getQty,
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

  const gridStyle = { ["--col-min" as string]: COL_MIN[size] } as CSSProperties;

  if (skeletonCount > 0) {
    return (
      <div className={styles.grid} style={gridStyle}>
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
      <div className={styles.grid} style={gridStyle}>
        {cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            onClick={onCardClick}
            rarityHint={rarityHint}
            inDeckQty={getQty?.(card)}
          />
        ))}
      </div>
      {loadingMore && (
        <div className={styles.grid} style={{ ...gridStyle, marginTop: 18 }}>
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
