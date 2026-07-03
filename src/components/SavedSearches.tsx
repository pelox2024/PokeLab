/**
 * Recherches enregistrées : barre de puces réappliquables + bouton « Enregistrer »
 * qui apparaît dès qu'une recherche ou des filtres sont actifs.
 */
import type { CardFilters } from "../api/types";
import { CATEGORIES, roleLabel, typeLabel } from "../lib/filters";
import { removeSavedSearch, saveSearch, useSavedSearches } from "../db/savedSearches";
import { toast } from "../store/toastStore";
import { Icon } from "./ui/Icon";
import styles from "./SavedSearches.module.css";

interface Props {
  search: string;
  filters: CardFilters;
  onApply: (query: string, filters: CardFilters) => void;
}

/** Un filtre est-il actif (hors valeurs vides) ? */
function hasFilters(f: CardFilters): boolean {
  return Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== false));
}

/** Résumé lisible d'une recherche (sert de nom par défaut). */
function describe(search: string, f: CardFilters): string {
  const parts: string[] = [];
  if (search.trim()) parts.push(`« ${search.trim()} »`);
  for (const r of f.roles ?? []) parts.push(roleLabel(r));
  for (const c of f.categories ?? []) parts.push(CATEGORIES.find((x) => x.value === c)?.label ?? c);
  for (const t of f.types ?? []) parts.push(typeLabel(t));
  if (f.standardLegal) parts.push("Standard");
  if (f.expandedLegal) parts.push("Expanded");
  return parts.slice(0, 4).join(" · ") || "Recherche";
}

export function SavedSearches({ search, filters, onApply }: Props) {
  const saved = useSavedSearches();
  const canSave = !!search.trim() || hasFilters(filters);

  // Évite d'enregistrer deux fois la même recherche.
  const sig = JSON.stringify({ q: search.trim(), f: filters });
  const alreadySaved = saved.some((s) => JSON.stringify({ q: s.query.trim(), f: s.filters }) === sig);

  if (saved.length === 0 && !canSave) return null;

  const onSave = async () => {
    await saveSearch(describe(search, filters), search, filters);
    toast("Recherche enregistrée", "success");
  };

  return (
    <div className={styles.bar}>
      {saved.map((s) => (
        <span key={s.id} className={styles.chip}>
          <button type="button" className={styles.apply} onClick={() => onApply(s.query, s.filters)} title={s.name}>
            <Icon name="spark" size={13} />
            {s.name}
          </button>
          <button
            type="button"
            className={styles.remove}
            onClick={() => removeSavedSearch(s.id)}
            aria-label={`Supprimer « ${s.name} »`}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}

      {canSave && !alreadySaved && (
        <button type="button" className={styles.save} onClick={onSave}>
          <Icon name="plus" size={13} />
          Enregistrer cette recherche
        </button>
      )}
    </div>
  );
}
