/**
 * Optimisation des images de cartes.
 *
 * Les images « small » de pokemontcg.io sont en réalité de gros PNG (~180 Ko).
 * On les sert via un proxy d'images (weserv.nl, adossé au CDN Cloudflare) qui
 * convertit en WebP, redimensionne et met en cache en périphérie → ~15 Ko,
 * beaucoup plus rapide. En cas d'échec du proxy, on retombe sur l'URL d'origine.
 */

const ENABLED = true;

/** URL optimisée (WebP, largeur cible) pour une image de carte. */
export function cardImg(url: string | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (!ENABLED || url.startsWith("data:")) return url;
  const stripped = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&output=webp&q=72&we`;
}
