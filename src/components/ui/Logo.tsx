/** Marque PokéLab : Pokéball stylisée (trait + bouton central). currentColor. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.4 12h6.1M14.5 12h6.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="rgba(10,14,22,0.85)" />
    </svg>
  );
}
