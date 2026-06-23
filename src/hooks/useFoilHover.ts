import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

interface FoilHoverOptions {
  /** Active l'inclinaison 3D (légère). Défaut: true. */
  tilt?: boolean;
  /** Active le reflet/foil (réservé aux cartes spéciales). Défaut: true. */
  glare?: boolean;
}

/**
 * Effet de survol "carte premium" : inclinaison 3D discrète + reflet (glare)
 * qui suit le pointeur. Mutation directe des variables CSS via ref (pas de
 * re-render). Désactivé si l'utilisateur préfère les animations réduites.
 */
export function useFoilHover<T extends HTMLElement>(options: FoilHoverOptions = {}) {
  const { tilt = true, glare = true } = options;
  const ref = useRef<T>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = prefersReducedMotion();
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      if (reduce.current) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      if (tilt) {
        // Inclinaison réduite (max ~5°) pour rester élégant.
        el.style.setProperty("--rx", `${((0.5 - py) * 5).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((px - 0.5) * 6).toFixed(2)}deg`);
      }
      if (glare) {
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        el.style.setProperty("--foil-opacity", "1");
        el.style.setProperty("--glare-opacity", "1");
      }
    },
    [tilt, glare],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--foil-opacity", "0");
    el.style.setProperty("--glare-opacity", "0");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
