# PokéLab — Deck Builder Pokémon TCG

Application web premium, **card-first**, pour explorer les cartes Pokémon TCG et
construire des decks. Interface française, dark mode / glassmorphism, avec une direction artistique « finance app / Apple dark glass ».

> État actuel : **Phase 1 / Lot 2.5 — Polish premium du Card Explorer**.

Vision compagnon : Explorer → Construire → **Collectionner → Compléter (prix/Cardmarket)** → Wishlist → Méta. Les types `CardPricing` / `CollectionItem` / `Binder` / `WishlistItem` / `DeckCompletion` sont préparés (architecture), sans interface en V1.

## Stack

- **Vite + React 19 + TypeScript**
- **React Router** (navigation)
- **TanStack Query** (appels API, cache, infinite scroll)
- **Dexie / IndexedDB** (persistance locale — socle prêt, branché en Phase 2)
- **CSS Modules + variables CSS** (design system, pas de Tailwind)
- Provider de cartes : **TCGdex** (REST, sans clé, multilingue)

## Démarrer

```bash
npm install
npm run dev      # serveur de dev (http://localhost:5173)
npm run build    # build de production (tsc + vite)
npm run preview  # prévisualiser le build
npm run lint     # ESLint
```

## Ce qui fonctionne

**Lot 1 — Fondations**
- AppShell premium en français (top nav + bottom nav mobile)
- Design system : `Button`, `Chip`, `Input`, `Select`, `Modal`, `Skeleton`,
  `EmptyState`, `Icon`
- Couche API abstraite (`CardProvider`) + base Dexie prête pour le Builder

**Lot 2 — Card Explorer complet**
- **Recherche bilingue FR/EN** : requête EN + FR fusionnée par id (Miaouss
  retrouve la carte Meowth), repli gracieux si une langue échoue. EN reste
  canonique pour les decklists.
- **Modal détail carte** premium (2 colonnes desktop / vertical mobile) :
  image foil interactive, attaques, talents, faiblesse, légalité, variantes,
  ESC + clic backdrop, états loading/erreur.
- **Variantes & foil** : mapping `variants`/`foil`, effets holo/reverse +
  inclinaison 3D et reflet suivant le pointeur (désactivés si
  `prefers-reduced-motion`).
- **FilterBar V1** : catégorie, type, sous-type, extension, rareté, regulation
  mark, légal Standard, réinitialiser — section avancée repliable.
- **Tri** Nom A-Z / Z-A (seul tri fiable côté TCGdex sur les briefs).
- **Fallback image** qualitatif + wording compteur (« X cartes affichées »).

## Structure

```
src/
  api/        cardApi (façade), types (modèles normalisés), tcgdexProvider
  components/ AppShell, CardGrid, CardTile, ui/ (primitives du design system)
  pages/      Cards (actif), Placeholder (Builder/MyDecks/Analysis/Settings)
  hooks/      useCards (TanStack Query)
  lib/        i18n (labels FR), useDebounce
  db/         db (Dexie), schema (Deck / DeckVersion / DeckCard)
  styles/     design-system.css (tokens), globals.css
```

## Roadmap

- **Phase 1** — Fondations + Card Explorer ← *terminée (Lots 1 & 2)*
- **Phase 2** — Builder + persistance locale (Dexie)
- **Phase 3** — Import / Export decklist (PTCG Live / Limitless)
- **Phase 4** — Analyse de deck (stats + warnings)
- **Phase 5** — Versions & comparaison
- **Phase 6** — Méta / Limitless

## Conventions

- **Données cartes en anglais** (compatibilité imports PTCG Live / Limitless),
  **interface 100 % française**.
- Format ciblé en V1 : **Standard**.
