# PokéLab — Deck Builder Pokémon TCG

Application web premium, **card-first**, pour explorer les cartes Pokémon TCG et
construire des decks. Interface française, dark mode / glassmorphism, avec une direction artistique « finance app / Apple dark glass ».

> État actuel : **Phase 1 / Lot 1 — Fondations + Card Explorer**.

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

## Ce qui fonctionne (Lot 1)

- AppShell premium en français (top nav + bottom nav mobile)
- Page **Cartes** : recherche debouncée, grille de cartes réelles via TCGdex,
  images lazy-loadées, infinite scroll, états **loading / vide / erreur**
- Design system : `Button`, `Chip`, `Input`, `Skeleton`, `EmptyState`, `Icon`
- Couche API abstraite (`CardProvider`) → on peut changer de provider sans
  toucher aux composants
- Modèles de données et base Dexie définis (prêts pour le Builder)

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

- **Phase 1** — Fondations + Card Explorer ← *en cours*
- **Phase 2** — Builder + persistance locale (Dexie)
- **Phase 3** — Import / Export decklist (PTCG Live / Limitless)
- **Phase 4** — Analyse de deck (stats + warnings)
- **Phase 5** — Versions & comparaison
- **Phase 6** — Méta / Limitless

## Conventions

- **Données cartes en anglais** (compatibilité imports PTCG Live / Limitless),
  **interface 100 % française**.
- Format ciblé en V1 : **Standard**.
