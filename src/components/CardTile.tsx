import { useState } from "react";
import type { CardBrief } from "../api/types";
import styles from "./CardTile.module.css";

interface CardTileProps {
  card: CardBrief;
  onClick?: (card: CardBrief) => void;
}

export function CardTile({ card, onClick }: CardTileProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <button type="button" className={styles.tile} onClick={() => onClick?.(card)}>
      <div className={styles.frame}>
        {!loaded && !errored && <span className={styles.shimmer} />}
        {card.imageUrl && !errored ? (
          <img
            className={[styles.img, loaded ? styles.imgLoaded : ""].filter(Boolean).join(" ")}
            src={card.imageUrl}
            alt={card.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        ) : null}
        {errored && (
          <div className={styles.fallback}>
            <span>{card.name}</span>
          </div>
        )}
      </div>
      <div className={styles.meta}>
        <span className={styles.name}>{card.name}</span>
        {card.localId && <span className={styles.num}>#{card.localId}</span>}
      </div>
    </button>
  );
}
