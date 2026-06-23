import type { CSSProperties } from "react";
import type { CardVisualTreatment } from "../../lib/foil";
import { getLayoutDims } from "../../lib/foil";
import styles from "./FoilOverlay.module.css";

interface FoilOverlayProps {
  treatment: CardVisualTreatment;
}

/**
 * Effet foil par zone, calqué sur la réalité Pokémon TCG :
 * - artbox  : brillance concentrée sur l'illustration (holo classique)
 * - reverse : 4 bandes autour de l'illustration (l'artwork reste net)
 * - full    : brillance sur toute la carte (full art / SIR / rainbow)
 * La géométrie de l'artbox dépend du layout (modern / legacy / trainer).
 * L'intensité suit --foil-opacity / --mx / --my posés par useFoilHover.
 */
export function FoilOverlay({ treatment }: FoilOverlayProps) {
  const { foilZone, foilStyle, layout } = treatment;
  if (foilZone === "none" || foilStyle === "none") return null;

  const dims = getLayoutDims(layout);
  const cssVars = {
    ["--art-top" as string]: dims.top,
    ["--art-left" as string]: dims.left,
    ["--art-right" as string]: dims.right,
    ["--art-height" as string]: dims.height,
  } as CSSProperties;

  const styleClass = foilStyle === "rainbow" ? styles.rainbow : styles.holo;

  if (foilZone === "full") {
    return <span className={[styles.layer, styles.full, styleClass].join(" ")} aria-hidden />;
  }

  if (foilZone === "artbox") {
    return (
      <span
        className={[styles.layer, styles.artbox, styleClass].join(" ")}
        style={cssVars}
        aria-hidden
      />
    );
  }

  // reverse : 4 bandes laissant l'artbox intacte
  return (
    <span className={styles.reverseGroup} style={cssVars} aria-hidden>
      <span className={[styles.layer, styles.rvTop, styles.reverse].join(" ")} />
      <span className={[styles.layer, styles.rvBottom, styles.reverse].join(" ")} />
      <span className={[styles.layer, styles.rvLeft, styles.reverse].join(" ")} />
      <span className={[styles.layer, styles.rvRight, styles.reverse].join(" ")} />
    </span>
  );
}
