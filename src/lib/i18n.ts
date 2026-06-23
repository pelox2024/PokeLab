/**
 * i18n léger — un simple dictionnaire de labels FR.
 * Pas d'architecture i18n lourde en V1. On centralise juste les textes
 * pour garder l'UI cohérente et faciliter une future internationalisation.
 */

export const fr = {
  app: {
    name: "PokéLab",
    tagline: "Deck Builder Pokémon TCG",
  },
  nav: {
    cards: "Cartes",
    builder: "Builder",
    myDecks: "Mes decks",
    analysis: "Analyse",
    settings: "Réglages",
  },
  cards: {
    title: "Cartes",
    subtitle: "Explorez toutes les cartes Pokémon TCG",
    searchPlaceholder: "Rechercher une carte…",
    resultsCount: (n: number) => `${n.toLocaleString("fr-FR")} cartes trouvées`,
    showingRange: (a: number, b: number) => `Affichage de ${a} à ${b}`,
    loading: "Chargement des cartes…",
    addToDeck: "Ajouter au deck",
    inDeck: "Dans le deck",
  },
  category: {
    pokemon: "Pokémon",
    trainer: "Dresseurs",
    energy: "Énergies",
  },
  filters: {
    title: "Filtres",
    category: "Catégorie",
    type: "Type",
    subtype: "Sous-type",
    set: "Extension",
    rarity: "Rareté",
    regulationMark: "Regulation mark",
    format: "Format",
    legality: "Légalité",
    reset: "Réinitialiser",
    all: "Tous",
    advanced: "Filtres avancés",
  },
  states: {
    emptyTitle: "Aucune carte trouvée",
    emptyBody: "Essayez un autre terme de recherche ou réinitialisez les filtres.",
    errorTitle: "Impossible de charger les cartes",
    errorBody: "L'API est peut-être momentanément indisponible. Réessayez.",
    retry: "Réessayer",
    comingSoonTitle: "Bientôt disponible",
  },
  builder: {
    comingSoon: "Le builder arrive à la prochaine étape.",
  },
  myDecks: {
    comingSoon: "La gestion des decks arrive bientôt.",
  },
  analysis: {
    comingSoon: "L'analyse de deck arrive bientôt.",
  },
  settings: {
    title: "Réglages",
    cardLanguage: "Langue des cartes",
    comingSoon: "Les réglages seront enrichis dans une prochaine étape.",
  },
} as const;

export type Dict = typeof fr;
