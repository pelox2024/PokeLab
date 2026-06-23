import type { FoilStyle } from "../../api/types";
import type { FoilZone } from "../../lib/foil";
import styles from "./FoilOverlay.module.css";

interface FoilOverlayProps {
  zone: FoilZone;
  style: FoilStyle;
}

/**
 * Effet foil par zone, calqué sur la réalité Pokémon TCG :
 * - artbox  : brillance concentrée sur l'illustration (holo classique)
 * - reverse : 4 bandes autour de l'illustration (l'artwork reste net)
 * - full    : brillance sur toute la carte (full art / SIR / rainbow)
 * L'intensité suit --foil-opacity / --mx / --my posés par useFoilHover.
 */
export function FoilOverlay({ zone, style }: FoilOverlayProps) {
  if (zone === "none" || style === "none") return null;

  const styleClass = style === "rainbow" ? styles.rainbow : styles.holo;

  if (zone === "full") {
    return <span className={[styles.layer, styles.full, styleClass].join(" ")} aria-hidden />;
  }

  if (zone === "artbox") {
    return <span className={[styles.layer, styles.artbox, styleClass].join(" ")} aria-hidden />;
  }

  // reverse : 4 bandes laissant l'artbox intacte
  return (
    <span className={styles.reverseGroup} aria-hidden>
      <span className={[styles.layer, styles.rvTop, styles.reverse].join(" ")} />
      <span className={[styles.layer, styles.rvBottom, styles.reverse].join(" ")} />
      <span className={[styles.layer, styles.rvLeft, styles.reverse].join(" ")} />
      <span className={[styles.layer, styles.rvRight, styles.reverse].join(" ")} />
    </span>
  );
}
