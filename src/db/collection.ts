/**
 * Collection locale (possédé par carte). V1 simple : une entrée par carte
 * (variante « normal »), quantité possédée. Clé = id global de carte
 * ("tcgdex:sv03-125"). Suffit pour calculer les cartes manquantes d'un deck.
 */
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { CollectionItem } from "./schema";

const nowIso = () => new Date().toISOString();

export interface OwnedInput {
  cardId: string;
  name: string;
  setCode?: string;
  number?: string;
  imageUrl?: string;
}

/** Fixe la quantité possédée d'une carte (0 = retire de la collection). */
export async function setOwned(input: OwnedInput, qty: number): Promise<void> {
  const id = input.cardId;
  if (qty <= 0) {
    await db.collection.delete(id);
    return;
  }
  const existing = await db.collection.get(id);
  const item: CollectionItem = {
    id,
    cardId: input.cardId,
    name: input.name,
    setCode: input.setCode,
    number: input.number,
    imageUrl: input.imageUrl ?? existing?.imageUrl,
    variant: "normal",
    quantity: qty,
    language: "en",
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await db.collection.put(item);
}

/** Incrémente/décrémente la quantité possédée. */
export async function adjustOwned(input: OwnedInput, delta: number): Promise<void> {
  const existing = await db.collection.get(input.cardId);
  await setOwned(input, (existing?.quantity ?? 0) + delta);
}

/** Liste réactive des cartes possédées (récentes d'abord). */
export function useCollection(): CollectionItem[] {
  const items = useLiveQuery(() => db.collection.toArray(), []);
  return useMemo(
    () => [...(items ?? [])].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)),
    [items],
  );
}

/** Map réactive cardId -> quantité possédée. */
export function useOwnedMap(): Map<string, number> {
  const items = useLiveQuery(() => db.collection.toArray(), []);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items ?? []) {
      if (it.cardId) m.set(it.cardId, (m.get(it.cardId) ?? 0) + it.quantity);
    }
    return m;
  }, [items]);
}
