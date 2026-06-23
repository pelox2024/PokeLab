import { useMemo, useState } from "react";
import type { CardBrief, FoilStyle } from "../api/types";
import { inferFoilFromName } from "../lib/foil";
import { useFoilHover } from "../hooks/useFoilHover";
import { Icon } from "./ui/Icon";
import styles from "./CardTile.module.css";

interface CardTileProps {
  card: CardBrief;
  onClick?: (card: CardBrief) => void;
  enableEffects?: boolean;
  /** Forcé si connu (modal). Sinon déduit du nom (grille). */
  foilStyle?: FoilStyle;
}

export function CardTile({ card, onClick, enableEffects = true, foilStyle }: CardTileProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const { ref, onPointerMove, onPointerLeave } = useFoilHover<HTMLDivElement>(enableEffects);

  const foil: FoilStyle = useMemo(
    () => foilStyle ?? inferFoilFromName(card.displayName || card.name),
    [foilStyle, card.displayName, card.name],
  );

  const alias = card.searchAliases?.[0];

  return (
    <button type="button" className={styles.tile} onClick={() => onClick?.(card)}>
      <div className={styles.perspective}>
        <div
          ref={ref}
          className={styles.frame}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          {!loaded && !errored && <span className={styles.shimmer} />}
          {card.imageUrl && !errored ? (
            <img
              className={[styles.img, loaded ? styles.imgLoaded : ""].filter(Boolean).join(" ")}
              src={card.imageUrl}
              alt={card.displayName || card.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
          ) : null}

          {errored && (
            <div className={styles.fallback}>
              <span className={styles.fbIcon}>
                <Icon name="cards" size={26} />
              </span>
              <span className={styles.fbName}>{card.displayName || card.name}</span>
              {card.localId && <span className={styles.fbNum}>N° {card.localId}</span>}
              <span className={styles.fbMsg}>Image indisponible</span>
            </div>
          )}

          {/* Effets foil (uniquement cartes spéciales) */}
          {foil !== "none" && loaded && !errored && (
            <span
              className={[
                styles.foil,
                foil === "reverse" ? styles.foilReverse : styles.foilHolo,
              ].join(" ")}
            />
          )}
          {/* Reflet qui suit le pointeur (toutes cartes) */}
          {loaded && !errored && <span className={styles.glare} />}
        </div>
      </div>

      <div className={styles.meta}>
        <span className={styles.name}>{card.displayName || card.name}</span>
        {card.localId && <span className={styles.num}>#{card.localId}</span>}
      </div>
      {alias && <span className={styles.alias}>{alias}</span>}
    </button>
  );
}
