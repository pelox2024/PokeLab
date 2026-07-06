import { useState } from "react";
import { cardImg } from "../../lib/img";
import { Icon } from "./Icon";
import styles from "./CardImg.module.css";

interface CardImgProps {
  url?: string;
  /** Largeur cible pour l'optimisation (px). */
  width: number;
  alt: string;
  className?: string;
}

/**
 * Image de carte optimisée (WebP via proxy CDN) avec squelette de chargement,
 * fondu à l'apparition et repli (image d'origine puis icône) en cas d'échec.
 */
export function CardImg({ url, width, alt, className }: CardImgProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (!url || errored) {
    return (
      <span className={[styles.wrap, styles.fallback, className].filter(Boolean).join(" ")} aria-label={alt}>
        <Icon name="cards" size={18} />
      </span>
    );
  }

  return (
    <span className={[styles.wrap, className].filter(Boolean).join(" ")}>
      {!loaded && <span className={styles.shimmer} />}
      <img
        className={[styles.img, loaded ? styles.loaded : ""].join(" ")}
        src={cardImg(url, width)}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.dataset.raw !== "1") {
            img.dataset.raw = "1";
            img.src = url;
          } else {
            setErrored(true);
          }
        }}
      />
    </span>
  );
}
