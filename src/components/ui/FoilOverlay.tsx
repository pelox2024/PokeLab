import type { CardVisualTreatment } from "../../lib/foil";
import styles from "./FoilOverlay.module.css";

interface FoilOverlayProps {
  treatment: CardVisualTreatment;
}

/**
 * Effet foil — décision produit Lot 2.7 : on ne rend QUE le shimmer
 * pleine carte (full art / SIR / hyper / rainbow…), qui ne dépend d'aucune
 * géométrie d'illustration. Les zones artbox/reverse restent dans les types
 * pour plus tard mais ne sont volontairement plus rendues (pas de rectangle
 * mal aligné). L'intensité suit --foil-opacity / --mx / --my (useFoilHover).
 */
export function FoilOverlay({ treatment }: FoilOverlayProps) {
  if (treatment.foilZone !== "full" || treatment.foilStyle === "none") return null;

  const styleClass = treatment.foilStyle === "rainbow" ? styles.rainbow : styles.holo;
  return <span className={[styles.layer, styles.full, styleClass].join(" ")} aria-hidden />;
}
