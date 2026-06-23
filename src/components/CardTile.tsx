import { useMemo, useState } from "react";
import type { CardBrief } from "../api/types";
import { getFoilPresentation } from "../lib/foil";
import { useFoilHover } from "../hooks/useFoilHover";
import { FoilOverlay } from "./ui/FoilOverlay";
import { Icon } from "./ui/Icon";
import styles from "./CardTile.module.css";

interface CardTileProps {
  card: CardBrief;
  onClick?: (card: CardBrief) => void;
}

export function CardTile({ card, onClick }: CardTileProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Brief : pas de rareté/variants -> présentation déduite du nom.
  const presentation = useMemo(
    () => getFoilPresentation({ name: card.name, displayName: card.displayName }),
    [card.name, card.displayName],
  );
  const special = presentation.zone !== "none";

  const { ref, onPointerMove, onPointerLeave } = useFoilHover<HTMLDivElement>({
    tilt: true,
    glare: special,
  });

  const alias = card.searchAliases?.[0];

  return (
    <button type="button" className={styles.tile} onClick={() => onClick?.(card)}>
      <div className={styles.perspective}>
        <div
          ref={ref}
          className={[styles.frame, special ? styles.special : ""].filter(Boolean).join(" ")}
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

          {loaded && !errored && special && (
            <>
              <FoilOverlay zone={presentation.zone} style={presentation.style} />
              <span className={styles.glare} />
            </>
          )}
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
