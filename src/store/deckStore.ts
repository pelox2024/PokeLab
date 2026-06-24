import { create } from "zustand";
import type { CardCategory } from "../api/types";
import type { DeckCard, DeckFormat } from "../db/schema";

export interface AddCardInput {
  cardId: string; // id global provider:providerId
  name: string;
  category?: CardCategory;
  number?: string;
  setCode?: string;
  imageUrl?: string;
  rarity?: string;
  subtypes?: string[];
}

interface DeckState {
  deckId: string | null;
  versionId: string | null;
  name: string;
  format: DeckFormat;
  cards: DeckCard[];

  load: (p: { deckId: string; versionId: string; name: string; format: DeckFormat; cards: DeckCard[] }) => void;
  reset: () => void;
  setName: (name: string) => void;
  setFormat: (format: DeckFormat) => void;
  add: (card: AddCardInput) => void;
  enrich: (cardId: string, patch: Partial<DeckCard>) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clearCards: () => void;
  /** Remplace toutes les cartes du deck (import de decklist). */
  replaceCards: (cards: DeckCard[]) => void;
}

export const useDeckStore = create<DeckState>((set) => ({
  deckId: null,
  versionId: null,
  name: "Nouveau deck",
  format: "standard",
  cards: [],

  load: (p) => set({ deckId: p.deckId, versionId: p.versionId, name: p.name, format: p.format, cards: p.cards }),
  reset: () => set({ deckId: null, versionId: null, name: "Nouveau deck", format: "standard", cards: [] }),
  setName: (name) => set({ name }),
  setFormat: (format) => set({ format }),

  add: (card) =>
    set((state) => {
      const existing = state.cards.find((c) => c.cardId === card.cardId);
      if (existing) {
        return {
          cards: state.cards.map((c) =>
            c.cardId === card.cardId ? { ...c, quantity: c.quantity + 1 } : c,
          ),
        };
      }
      const newCard: DeckCard = {
        id: card.cardId,
        cardId: card.cardId,
        name: card.name,
        quantity: 1,
        category: card.category ?? "Unknown",
        number: card.number,
        setCode: card.setCode,
        imageUrl: card.imageUrl,
        rarity: card.rarity,
        subtypes: card.subtypes,
        manual: false,
      };
      return { cards: [...state.cards, newCard] };
    }),

  enrich: (cardId, patch) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.cardId === cardId ? { ...c, ...patch } : c)),
    })),

  setQty: (id, qty) =>
    set((state) => ({
      cards: qty <= 0 ? state.cards.filter((c) => c.id !== id) : state.cards.map((c) => (c.id === id ? { ...c, quantity: qty } : c)),
    })),

  remove: (id) => set((state) => ({ cards: state.cards.filter((c) => c.id !== id) })),
  clearCards: () => set({ cards: [] }),
  replaceCards: (cards) => set({ cards }),
}));

export function deckTotal(cards: DeckCard[]): number {
  return cards.reduce((sum, c) => sum + c.quantity, 0);
}
