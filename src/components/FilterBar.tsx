import { useMemo, useState } from "react";
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
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  filters: CardFilters;
  onChange: (next: CardFilters) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  sets?: SetInfo[];
}

function countActive(f: CardFilters): number {
  return Object.values(f).filter((v) => v !== undefined && v !== false && v !== "").length;
}

export function FilterBar({ filters, onChange, sort, onSortChange, sets }: FilterBarProps) {
  const [advanced, setAdvanced] = useState(false);
  const activeCount = countActive(filters);

  const setOptions = useMemo(
    () => (sets ?? []).map((s) => ({ value: s.id, label: s.name })),
    [sets],
  );

  const toggle = <K extends keyof CardFilters>(key: K, value: CardFilters[K]) => {
    onChange({ ...filters, [key]: filters[key] === value ? undefined : value });
  };

  return (
    <div className={styles.bar}>
      {/* Ligne principale */}
      <div className={styles.row}>
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
        </div>

        <div className={styles.spacer} />

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
            iconLeft={<Icon name="sort" size={17} />}
            onClick={() => setAdvanced((v) => !v)}
          >
            {fr.filters.advanced}
            {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
          </Button>
        </div>
      </div>

      {/* Types Pokémon (rangée toujours visible) */}
      <div className={styles.types}>
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

      {/* Section avancée repliable */}
      {advanced && (
        <div className={styles.advanced}>
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

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <span className={styles.label}>{fr.filters.set}</span>
              <Select
                options={setOptions}
                placeholder={fr.filters.setPlaceholder}
                value={filters.set ?? ""}
                onChange={(e) => onChange({ ...filters, set: e.target.value || undefined })}
                className={styles.setSelect}
              />
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

            {activeCount > 0 && (
              <Button variant="subtle" size="sm" onClick={() => onChange({})}>
                {fr.filters.reset}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
