/**
 * Sauvegarde / restauration des données locales (local-first). Export en un
 * seul fichier JSON, import par fusion (bulkPut, non destructif) et effacement.
 */
import { db } from "./db";

export interface BackupData {
  app: "pokelab";
  version: number;
  exportedAt: string;
  decks: unknown[];
  versions: unknown[];
  collection: unknown[];
  savedSearches: unknown[];
  wishlist: unknown[];
  binders: unknown[];
}

export async function exportAll(): Promise<BackupData> {
  const [decks, versions, collection, savedSearches, wishlist, binders] = await Promise.all([
    db.decks.toArray(),
    db.versions.toArray(),
    db.collection.toArray(),
    db.savedSearches.toArray(),
    db.wishlist.toArray(),
    db.binders.toArray(),
  ]);
  return {
    app: "pokelab",
    version: 3,
    exportedAt: new Date().toISOString(),
    decks,
    versions,
    collection,
    savedSearches,
    wishlist,
    binders,
  };
}

/** Déclenche le téléchargement d'un fichier de sauvegarde. */
export async function downloadBackup(): Promise<void> {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pokelab-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Importe une sauvegarde par fusion (ajoute/écrase par id, sans supprimer). */
export async function importBackup(raw: unknown): Promise<{ decks: number; collection: number }> {
  const d = raw as Partial<BackupData> | null;
  if (!d || d.app !== "pokelab" || !Array.isArray(d.decks)) {
    throw new Error("Fichier de sauvegarde invalide.");
  }
  await db.transaction(
    "rw",
    [db.decks, db.versions, db.collection, db.savedSearches, db.wishlist, db.binders],
    async () => {
      if (Array.isArray(d.decks)) await db.decks.bulkPut(d.decks as never);
      if (Array.isArray(d.versions)) await db.versions.bulkPut(d.versions as never);
      if (Array.isArray(d.collection)) await db.collection.bulkPut(d.collection as never);
      if (Array.isArray(d.savedSearches)) await db.savedSearches.bulkPut(d.savedSearches as never);
      if (Array.isArray(d.wishlist)) await db.wishlist.bulkPut(d.wishlist as never);
      if (Array.isArray(d.binders)) await db.binders.bulkPut(d.binders as never);
    },
  );
  return { decks: d.decks?.length ?? 0, collection: (d.collection as unknown[] | undefined)?.length ?? 0 };
}

/** Efface toutes les données locales (decks, collection, recherches, cache…). */
export async function wipeAll(): Promise<void> {
  await db.transaction(
    "rw",
    [db.decks, db.versions, db.collection, db.savedSearches, db.wishlist, db.binders, db.cardCache],
    async () => {
      await Promise.all([
        db.decks.clear(),
        db.versions.clear(),
        db.collection.clear(),
        db.savedSearches.clear(),
        db.wishlist.clear(),
        db.binders.clear(),
        db.cardCache.clear(),
      ]);
    },
  );
}
