import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { CardBrief } from "../api/types";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { CardTile } from "./CardTile";
import { Skeleton } from "./ui/Skeleton";
import styles from "./CardGrid.module.css";

export type GridSize = "compact" | "normal" | "large";

const COL_MIN_DESKTOP: Record<GridSize, string> = {
  compact: "112px",
  normal: "142px",
  large: "186px",
};
const COL_MIN_MOBILE: Record<GridSize, string> = {
  compact: "96px",
  normal: "124px",
  large: "162px",
};

export interface CardSection {
  key: string;
  title: string;
  subtitle?: string;
  cards: CardBrief[];
}

interface CardGridProps {
  cards?: CardBrief[];
  sections?: CardSection[];
  onCardClick?: (card: CardBrief) => void;
  loadingMore?: boolean;
  onReachEnd?: () => void;
  skeletonCount?: number;
  size?: GridSize;
  rarityHint?: string[];
  getQty?: (card: CardBrief) => number;
  getOwned?: (card: CardBrief) => number;
  onOwnAdjust?: (card: CardBrief, delta: number) => void;
}

export function CardGrid({
  cards,
  sections,
  onCardClick,
  loadingMore,
  onReachEnd,
  skeletonCount = 0,
  size = "normal",
  rarityHint,
  getQty,
  getOwned,
  onOwnAdjust,
}: CardGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const colMin = (isMobile ? COL_MIN_MOBILE : COL_MIN_DESKTOP)[size];

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

  const gridStyle = { ["--col-min" as string]: colMin } as CSSProperties;

  const renderTile = (card: CardBrief) => (
    <CardTile
      key={card.id}
      card={card}
      onClick={onCardClick}
      rarityHint={rarityHint}
      inDeckQty={getQty?.(card)}
      owned={getOwned?.(card)}
      onOwnAdjust={onOwnAdjust}
    />
  );

  const skeletons = (n: number) =>
    Array.from({ length: n }).map((_, i) => (
      <div key={i} className={styles.skelTile}>
        <Skeleton height="100%" radius="var(--radius-md)" className={styles.skelImg} />
        <Skeleton width="70%" height="12px" />
      </div>
    ));

  if (skeletonCount > 0) {
    return (
      <div className={styles.grid} style={gridStyle}>
        {skeletons(skeletonCount)}
      </div>
    );
  }

  return (
    <>
      {sections
        ? sections
            .filter((s) => s.cards.length > 0)
            .map((s) => (
              <section key={s.key} className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>{s.title}</span>
                  {s.subtitle && <span className={styles.sectionSub}>{s.subtitle}</span>}
                </div>
                <div className={styles.grid} style={gridStyle}>
                  {s.cards.map(renderTile)}
                </div>
              </section>
            ))
        : (
            <div className={styles.grid} style={gridStyle}>
              {(cards ?? []).map(renderTile)}
            </div>
          )}
      {loadingMore && (
        <div className={styles.grid} style={{ ...gridStyle, marginTop: 18 }}>
          {skeletons(8)}
        </div>
      )}
      <div ref={sentinelRef} className={styles.sentinel} />
    </>
  );
}
