import { db } from "./db";
import type { Deck, DeckFormat, DeckVersion } from "./schema";

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
const now = () => Date.now();

export async function createDeck(
  name = "Nouveau deck",
  format: DeckFormat = "standard",
): Promise<{ deck: Deck; version: DeckVersion }> {
  const t = now();
  const deckId = uid();
  const deck: Deck = { id: deckId, name, format, tags: [], createdAt: t, updatedAt: t, archived: false };
  const version: DeckVersion = { id: uid(), deckId, name: "Version A", cards: [], createdAt: t, updatedAt: t };
  await db.transaction("rw", db.decks, db.versions, async () => {
    await db.decks.add(deck);
    await db.versions.add(version);
  });
  return { deck, version };
}

export async function getFirstVersion(deckId: string): Promise<DeckVersion | undefined> {
  return db.versions.where("deckId").equals(deckId).first();
}

export async function getDeck(deckId: string): Promise<Deck | undefined> {
  return db.decks.get(deckId);
}

export async function saveVersion(version: DeckVersion): Promise<void> {
  const updated = { ...version, updatedAt: now() };
  await db.versions.put(updated);
  await db.decks.update(version.deckId, { updatedAt: now() });
}

export async function persistDeck(
  deckId: string,
  versionId: string,
  name: string,
  format: DeckFormat,
  cards: DeckVersion["cards"],
): Promise<void> {
  await db.transaction("rw", db.decks, db.versions, async () => {
    await db.versions.update(versionId, { cards, updatedAt: now() });
    await db.decks.update(deckId, { name, format, updatedAt: now() });
  });
}

export async function updateDeckMeta(
  deckId: string,
  patch: Partial<Pick<Deck, "name" | "format" | "archived" | "tags" | "notes">>,
): Promise<void> {
  await db.decks.update(deckId, { ...patch, updatedAt: now() });
}

export async function deleteDeck(deckId: string): Promise<void> {
  await db.transaction("rw", db.decks, db.versions, async () => {
    await db.versions.where("deckId").equals(deckId).delete();
    await db.decks.delete(deckId);
  });
}

export async function duplicateDeck(deckId: string): Promise<string | undefined> {
  const deck = await db.decks.get(deckId);
  if (!deck) return undefined;
  const versions = await db.versions.where("deckId").equals(deckId).toArray();
  const t = now();
  const newDeckId = uid();
  const newDeck: Deck = { ...deck, id: newDeckId, name: `${deck.name} (copie)`, createdAt: t, updatedAt: t };
  const newVersions: DeckVersion[] = versions.map((v) => ({ ...v, id: uid(), deckId: newDeckId, createdAt: t, updatedAt: t }));
  await db.transaction("rw", db.decks, db.versions, async () => {
    await db.decks.add(newDeck);
    await db.versions.bulkAdd(newVersions);
  });
  return newDeckId;
}
