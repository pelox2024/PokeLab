/**
 * Recherches enregistrées : un terme + un jeu de filtres (rôles, types,
 * légalité…) réappliquables en un clic depuis la page Cartes.
 */
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { SavedSearch } from "./schema";
import type { CardFilters } from "../api/types";

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Liste des recherches enregistrées (plus récentes d'abord). */
export function useSavedSearches(): SavedSearch[] {
  return useLiveQuery(() => db.savedSearches.orderBy("createdAt").reverse().toArray(), [], []);
}

export async function saveSearch(name: string, query: string, filters: CardFilters): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await db.savedSearches.add({
    id: uid(),
    name: clean,
    query: query.trim(),
    filters,
    createdAt: Date.now(),
  });
}

export async function removeSavedSearch(id: string): Promise<void> {
  await db.savedSearches.delete(id);
}
