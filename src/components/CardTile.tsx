import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CardBrief, CardRecord, FoilStyle } from "../api/types";
import { getCardVisualTreatment, isFullArtRarity } from "../lib/foil";
import type { CardVisualTreatment } from "../lib/foil";
import { useFoilHover } from "../hooks/useFoilHover";
import { FoilOverlay } from "./ui/FoilOverlay";
import { Icon } from "./ui/Icon";
import styles from "./CardTile.module.css";

interface CardTileProps {
  card: CardBrief;
  onClick?: (card: CardBrief) => void;
  /** Raretés du filtre actif : si full-card, on peut appliquer un foil léger. */
  rarityHint?: string[];
  /** Quantité présente dans le deck en cours (badge). */
  inDeckQty?: number;
}

export function CardTile({ card, onClick, rarityHint, inDeckQty }: CardTileProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const queryClient = useQueryClient();

  // Enrichissement progressif : si la carte a déjà été ouverte (cache détail),
  // on applique le traitement précis. Aucun appel réseau supplémentaire.
  const treatment = useMemo<CardVisualTreatment>(() => {
    const cached = queryClient.getQueryData<CardRecord>(["cards", "detail", card.providerId]);
    if (cached) return getCardVisualTreatment(cached);
    const fullHint = rarityHint?.find((r) => isFullArtRarity(r));
    if (fullHint) {
      const style: FoilStyle = /rainbow|gold|secret|hyper/i.test(fullHint) ? "rainbow" : "holo";
      return {
        foilZone: "full",
        foilStyle: style,
        layout: "full-art",
        confidence: "medium",
        reason: "Filtre rareté full-card",
      };
    }
    // Brief seul : pas d'effet précis (confiance trop faible).
    return getCardVisualTreatment({ name: card.name, displayName: card.displayName });
  }, [queryClient, card.providerId, card.name, card.displayName, rarityHint]);

  const special = treatment.foilZone !== "none";
  const showFallback = !card.imageUrl || errored;

  const { ref, onPointerMove, onPointerLeave } = useFoilHover<HTMLDivElement>({
    tilt: true,
    glare: special,
  });

  const frameStyle = {
    ["--foil-strength" as string]: special && treatment.confidence === "high" ? 1 : 0.5,
  } as CSSProperties;

  const alias = card.searchAliases?.[0];

  return (
    <button type="button" className={styles.tile} onClick={() => onClick?.(card)}>
      <div className={styles.perspective}>
        <div
          ref={ref}
          className={[styles.frame, special ? styles.special : ""].filter(Boolean).join(" ")}
          style={frameStyle}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          {!loaded && !showFallback && <span className={styles.shimmer} />}
          {!showFallback && (
            <img
              className={[styles.img, loaded ? styles.imgLoaded : ""].filter(Boolean).join(" ")}
              src={card.imageUrl}
              alt={card.displayName || card.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
          )}

          {showFallback && (
            <div className={styles.fallback}>
              <span className={styles.fbIcon}>
                <Icon name="cards" size={26} />
              </span>
              <span className={styles.fbName}>{card.displayName || card.name}</span>
              {card.localId && <span className={styles.fbNum}>N° {card.localId}</span>}
              <span className={styles.fbMsg}>Image indisponible</span>
            </div>
          )}

          {loaded && !showFallback && special && (
            <>
              <FoilOverlay treatment={treatment} />
              <span className={styles.glare} />
            </>
          )}

          {inDeckQty != null && inDeckQty > 0 && <span className={styles.deckBadge}>{inDeckQty}</span>}
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
