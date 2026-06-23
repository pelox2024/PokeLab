import { useState } from "react";
import type { ReactNode } from "react";
import type { CardFilters, SetInfo, SortKey } from "../api/types";
import {
  CATEGORIES,
  POKEMON_TYPES,
  RARITIES,
  REGULATION_MARKS,
  SORT_OPTIONS,
  SUBTYPES,
  typeLabel,
} from "../lib/filters";
import { fr } from "../lib/i18n";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Chip } from "./ui/Chip";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { TypeIcon } from "./ui/TypeIcon";
import { BottomSheet } from "./ui/BottomSheet";
import { SetPicker } from "./SetPicker";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  filters: CardFilters;
  onChange: (next: CardFilters) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  sets?: SetInfo[];
  resultCount?: number;
  hasMore?: boolean;
}

type ArrayKey = "categories" | "types" | "subtypes" | "rarities" | "regulationMarks";

interface ActiveChip {
  id: string;
  label: string;
  icon?: string;
  remove: () => void;
}

export function FilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  sets,
  resultCount,
  hasMore,
}: FilterBarProps) {
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [advanced, setAdvanced] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const has = (key: ArrayKey, value: string) => (filters[key] ?? []).includes(value);

  const toggle = (key: ArrayKey, value: string) => {
    const cur = filters[key] ?? [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    onChange({ ...filters, [key]: next.length ? next : undefined });
  };

  const toggleBool = (key: "standardLegal" | "expandedLegal") =>
    onChange({ ...filters, [key]: filters[key] ? undefined : true });

  const removeValue = (key: ArrayKey, value: string) =>
    onChange({ ...filters, [key]: (filters[key] ?? []).filter((v) => v !== value) });

  // ---- Chips actifs ----
  const activeChips: ActiveChip[] = [];
  for (const c of filters.categories ?? [])
    activeChips.push({ id: `cat-${c}`, label: CATEGORIES.find((x) => x.value === c)?.label ?? c, remove: () => removeValue("categories", c) });
  for (const t of filters.types ?? [])
    activeChips.push({ id: `type-${t}`, label: typeLabel(t), icon: t, remove: () => removeValue("types", t) });
  for (const s of filters.subtypes ?? [])
    activeChips.push({ id: `sub-${s}`, label: SUBTYPES.find((x) => x.value === s)?.label ?? s, remove: () => removeValue("subtypes", s) });
  for (const r of filters.rarities ?? [])
    activeChips.push({ id: `rar-${r}`, label: r, remove: () => removeValue("rarities", r) });
  for (const m of filters.regulationMarks ?? [])
    activeChips.push({ id: `reg-${m}`, label: `Reg. ${m}`, remove: () => removeValue("regulationMarks", m) });
  if (filters.set)
    activeChips.push({ id: "set", label: sets?.find((s) => s.id === filters.set)?.name ?? filters.set, remove: () => onChange({ ...filters, set: undefined }) });
  if (filters.standardLegal)
    activeChips.push({ id: "std", label: fr.detail.standard, remove: () => toggleBool("standardLegal") });
  if (filters.expandedLegal)
    activeChips.push({ id: "exp", label: fr.detail.expanded, remove: () => toggleBool("expandedLegal") });

  const hasActive = activeChips.length > 0;

  // ---- Groupes de filtres (réutilisés desktop inline + sheet mobile) ----
  const renderGroups = (includeTypes: boolean): ReactNode => (
    <div className={styles.groups}>
      {includeTypes && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{fr.filters.type}</span>
          <div className={styles.group}>
            {POKEMON_TYPES.map((t) => (
              <Chip key={t.value} active={has("types", t.value)} accent={t.color} onClick={() => toggle("types", t.value)}>
                <TypeIcon type={t.value} size="sm" withBg={false} />
                {t.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Carte</span>
        <span className={styles.label}>{fr.filters.subtype}</span>
        <div className={styles.group}>
          {SUBTYPES.map((s) => (
            <Chip key={s.value} active={has("subtypes", s.value)} onClick={() => toggle("subtypes", s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Compétitif</span>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <span className={styles.label}>{fr.filters.legality}</span>
            <div className={styles.group}>
              <Chip active={!!filters.standardLegal} accent="var(--success)" onClick={() => toggleBool("standardLegal")}>
                {fr.detail.standard}
              </Chip>
              <Chip active={!!filters.expandedLegal} accent="var(--success)" onClick={() => toggleBool("expandedLegal")}>
                {fr.detail.expanded}
              </Chip>
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>{fr.filters.regulationMark}</span>
            <div className={styles.group}>
              {REGULATION_MARKS.map((m) => (
                <Chip key={m} active={has("regulationMarks", m)} onClick={() => toggle("regulationMarks", m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Collection</span>
        <span className={styles.label}>{fr.filters.rarity}</span>
        <div className={styles.group}>
          {RARITIES.map((r) => (
            <Chip key={r} active={has("rarities", r)} onClick={() => toggle("rarities", r)}>
              {r}
            </Chip>
          ))}
        </div>
        <div className={styles.field}>
          <span className={styles.label}>{fr.filters.set}</span>
          <SetPicker sets={sets ?? []} value={filters.set} onChange={(id) => onChange({ ...filters, set: id })} placeholder={fr.filters.setPlaceholder} />
        </div>
      </div>
    </div>
  );

  const filterCount = activeChips.length;
  const seeLabel = resultCount != null ? `Voir ${resultCount}${hasMore ? "+" : ""} cartes` : "Voir les cartes";

  return (
    <div className={styles.bar}>
      {/* Ligne rapide */}
      <div className={styles.quick}>
        <div className={styles.quickChips}>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} active={has("categories", c.value)} onClick={() => toggle("categories", c.value)}>
              {c.label}
            </Chip>
          ))}
          {!isMobile && <span className={styles.divider} />}
          {!isMobile &&
            POKEMON_TYPES.map((t) => (
              <Chip key={t.value} active={has("types", t.value)} accent={t.color} onClick={() => toggle("types", t.value)} title={t.label}>
                <TypeIcon type={t.value} size="sm" withBg={false} />
                {t.label}
              </Chip>
            ))}
        </div>

        <div className={styles.tools}>
          {!isMobile && (
            <Select
              options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              aria-label={fr.cards.sort}
            />
          )}
          <Button
            variant={advanced || sheetOpen || filterCount ? "primary" : "ghost"}
            size="md"
            iconLeft={<Icon name="sort" size={16} />}
            onClick={() => (isMobile ? setSheetOpen(true) : setAdvanced((v) => !v))}
          >
            {fr.filters.title}
            {filterCount > 0 && <span className={styles.badge}>{filterCount}</span>}
          </Button>
        </div>
      </div>

      {/* Chips actifs */}
      {hasActive && (
        <div className={styles.active}>
          {activeChips.map((c) => (
            <button key={c.id} type="button" className={styles.activeChip} onClick={c.remove}>
              {c.icon && <TypeIcon type={c.icon} size="sm" withBg={false} />}
              {c.label}
              <Icon name="close" size={12} />
            </button>
          ))}
          <button type="button" className={styles.resetAll} onClick={() => onChange({})}>
            {fr.filters.resetAll}
          </button>
        </div>
      )}

      {/* Desktop : panneau inline */}
      {!isMobile && (
        <div className={[styles.advWrap, advanced ? styles.advOpen : ""].filter(Boolean).join(" ")}>
          <div className={styles.advInner}>
            <div className={styles.advPanel}>{renderGroups(false)}</div>
          </div>
        </div>
      )}

      {/* Mobile : bottom sheet */}
      {isMobile && (
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={fr.filters.title}
          footer={
            <>
              <Select
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={sort}
                onChange={(e) => onSortChange(e.target.value as SortKey)}
                aria-label={fr.cards.sort}
              />
              {hasActive && (
                <button type="button" className={styles.sheetReset} onClick={() => onChange({})}>
                  {fr.filters.resetAll}
                </button>
              )}
              <Button variant="primary" size="md" className={styles.sheetSee} onClick={() => setSheetOpen(false)}>
                {seeLabel}
              </Button>
            </>
          }
        >
          {renderGroups(true)}
        </BottomSheet>
      )}
    </div>
  );
}
