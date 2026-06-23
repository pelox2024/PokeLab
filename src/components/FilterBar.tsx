import { useState } from "react";
import type { CardFilters, SetInfo, SortKey } from "../api/types";
import {
  CATEGORIES,
  POKEMON_TYPES,
  RARITIES,
  REGULATION_MARKS,
  SORT_OPTIONS,
  SUBTYPES,
} from "../lib/filters";
import { fr } from "../lib/i18n";
import { Chip } from "./ui/Chip";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { SetPicker } from "./SetPicker";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  filters: CardFilters;
  onChange: (next: CardFilters) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  sets?: SetInfo[];
}

interface ActiveChip {
  key: keyof CardFilters;
  label: string;
}

function buildActiveChips(f: CardFilters, sets?: SetInfo[]): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (f.category) {
    chips.push({
      key: "category",
      label: CATEGORIES.find((c) => c.value === f.category)?.label ?? f.category,
    });
  }
  if (f.type) {
    chips.push({
      key: "type",
      label: POKEMON_TYPES.find((t) => t.value === f.type)?.label ?? f.type,
    });
  }
  if (f.subtype) {
    chips.push({
      key: "subtype",
      label: SUBTYPES.find((s) => s.value === f.subtype)?.label ?? f.subtype,
    });
  }
  if (f.rarity) chips.push({ key: "rarity", label: f.rarity });
  if (f.regulationMark) chips.push({ key: "regulationMark", label: `Reg. ${f.regulationMark}` });
  if (f.set) {
    chips.push({ key: "set", label: sets?.find((s) => s.id === f.set)?.name ?? f.set });
  }
  if (f.standardLegal) chips.push({ key: "standardLegal", label: fr.detail.standard });
  return chips;
}

export function FilterBar({ filters, onChange, sort, onSortChange, sets }: FilterBarProps) {
  const [advanced, setAdvanced] = useState(false);
  const activeChips = buildActiveChips(filters, sets);
  const hasActive = activeChips.length > 0;

  const toggle = <K extends keyof CardFilters>(key: K, value: CardFilters[K]) => {
    onChange({ ...filters, [key]: filters[key] === value ? undefined : value });
  };

  const clear = (key: keyof CardFilters) => {
    const next = { ...filters };
    delete next[key];
    onChange(next);
  };

  return (
    <div className={styles.bar}>
      {/* Ligne rapide : catégories + types + outils */}
      <div className={styles.quick}>
        <div className={styles.group}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={filters.category === c.value}
              onClick={() => toggle("category", c.value)}
            >
              {c.label}
            </Chip>
          ))}
          <span className={styles.divider} />
          {POKEMON_TYPES.map((t) => (
            <Chip
              key={t.value}
              active={filters.type === t.value}
              accent={t.color}
              onClick={() => toggle("type", t.value)}
              title={t.label}
            >
              <span className={styles.dot} style={{ background: t.color }} />
              {t.label}
            </Chip>
          ))}
        </div>

        <div className={styles.tools}>
          <Select
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            aria-label={fr.cards.sort}
          />
          <Button
            variant={advanced ? "primary" : "ghost"}
            size="md"
            iconLeft={<Icon name="sort" size={16} />}
            onClick={() => setAdvanced((v) => !v)}
          >
            {fr.filters.advanced}
            {hasActive && <span className={styles.badge}>{activeChips.length}</span>}
          </Button>
        </div>
      </div>

      {/* Résumé des filtres actifs */}
      {hasActive && (
        <div className={styles.active}>
          {activeChips.map((c) => (
            <button key={c.key} type="button" className={styles.activeChip} onClick={() => clear(c.key)}>
              {c.label}
              <Icon name="close" size={12} />
            </button>
          ))}
          <button type="button" className={styles.resetAll} onClick={() => onChange({})}>
            {fr.filters.resetAll}
          </button>
        </div>
      )}

      {/* Section avancée — collapse animé */}
      <div className={[styles.advWrap, advanced ? styles.advOpen : ""].filter(Boolean).join(" ")}>
        <div className={styles.advInner}>
          <div className={styles.advPanel}>
            <div className={styles.field}>
              <span className={styles.label}>{fr.filters.subtype}</span>
              <div className={styles.group}>
                {SUBTYPES.map((s) => (
                  <Chip
                    key={s.value}
                    active={filters.subtype === s.value}
                    onClick={() => toggle("subtype", s.value)}
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.label}>{fr.filters.rarity}</span>
              <div className={styles.group}>
                {RARITIES.map((r) => (
                  <Chip key={r} active={filters.rarity === r} onClick={() => toggle("rarity", r)}>
                    {r}
                  </Chip>
                ))}
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>{fr.filters.regulationMark}</span>
                <div className={styles.group}>
                  {REGULATION_MARKS.map((m) => (
                    <Chip
                      key={m}
                      active={filters.regulationMark === m}
                      onClick={() => toggle("regulationMark", m)}
                    >
                      {m}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>{fr.filters.format}</span>
                <Chip
                  active={!!filters.standardLegal}
                  onClick={() => toggle("standardLegal", true)}
                  accent="var(--success)"
                >
                  {fr.filters.standardLegal}
                </Chip>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>{fr.filters.set}</span>
                <SetPicker
                  sets={sets ?? []}
                  value={filters.set}
                  onChange={(id) => onChange({ ...filters, set: id })}
                  placeholder={fr.filters.setPlaceholder}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
