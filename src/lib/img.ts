/**
 * Optimisation des images de cartes.
 *
 * Les images « small » de pokemontcg.io sont en réalité de gros PNG (~180 Ko).
 * On les sert redimensionnées + converties en format moderne (WebP/AVIF) via
 * un CDN d'images :
 *   - Cloudinary (fetch delivery) si un « cloud name » est configuré ;
 *   - sinon repli sur weserv.nl (proxy gratuit adossé à Cloudflare).
 * En dernier recours, les composants retombent sur l'URL d'origine.
 */

// ⚠️ Renseigner ici le « cloud name » Cloudinary pour activer Cloudinary
// (fetch delivery non signé à activer côté compte). Vide = repli weserv.
const CLOUDINARY_CLOUD =
  (import.meta.env.VITE_CLOUDINARY_CLOUD as string | undefined) ?? "";

/** URL optimisée (format moderne, largeur cible) pour une image de carte. */
export function cardImg(url: string | undefined, width: number): string | undefined {
  if (!url || url.startsWith("data:")) return url;

  if (CLOUDINARY_CLOUD) {
    // f_auto (AVIF/WebP), q_auto (qualité auto), c_limit (pas d'agrandissement).
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/f_auto,q_auto,c_limit,w_${width}/${encodeURIComponent(url)}`;
  }

  const stripped = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&output=webp&q=72&we`;
}
