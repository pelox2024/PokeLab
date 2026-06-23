import { useEffect, useMemo, useRef, useState } from "react";
import type { SetInfo } from "../api/types";
import { seriesRank } from "../lib/filters";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Icon } from "./ui/Icon";
import { BottomSheet } from "./ui/BottomSheet";
import styles from "./SetPicker.module.css";

interface SetPickerProps {
  sets: SetInfo[];
  value?: string;
  onChange: (id?: string) => void;
  placeholder: string;
}

interface SeriesGroup {
  seriesId?: string;
  seriesName: string;
  sets: SetInfo[];
}

function sortSets(a: SetInfo, b: SetInfo): number {
  const ra = seriesRank(a.seriesId);
  const rb = seriesRank(b.seriesId);
  if (ra !== rb) return ra - rb;
  return b.id.localeCompare(a.id);
}

function groupBySeries(sets: SetInfo[]): SeriesGroup[] {
  const map = new Map<string, SeriesGroup>();
  for (const s of sets) {
    const key = s.seriesId ?? "_";
    let g = map.get(key);
    if (!g) {
      g = { seriesId: s.seriesId, seriesName: s.seriesName ?? "Autres", sets: [] };
      map.set(key, g);
    }
    g.sets.push(s);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => seriesRank(a.seriesId) - seriesRank(b.seriesId));
  for (const g of groups) g.sets.sort(sortSets);
  return groups;
}

function SetRow({ set, active, onPick }: { set: SetInfo; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      className={[styles.option, active ? styles.optActive : ""].filter(Boolean).join(" ")}
      onClick={onPick}
    >
      <span className={styles.logoBox}>
        {set.logoUrl ? (
          <img src={set.logoUrl} alt="" loading="lazy" className={styles.logo} />
        ) : (
          <Icon name="decks" size={16} />
        )}
      </span>
      <span className={styles.optMain}>
        <span className={styles.optName}>{set.name}</span>
        <span className={styles.optMeta}>
          {set.seriesName ?? "—"}
          {set.cardCount != null && <span> · {set.cardCount} cartes</span>}
        </span>
      </span>
      <span className={styles.optId}>{set.id.toUpperCase()}</span>
    </button>
  );
}

function PickerContent({
  sets,
  value,
  placeholder,
  onPick,
}: {
  sets: SetInfo[];
  value?: string;
  placeholder: string;
  onPick: (id?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const recent = useMemo(() => [...sets].sort(sortSets).slice(0, 6), [sets]);
  const groups = useMemo(() => groupBySeries(sets), [sets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return [...sets]
      .filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .sort(sortSets);
  }, [sets, query]);

  const toggleGroup = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <div className={styles.searchRow}>
        <Icon name="search" size={15} />
        <input
          autoFocus
          className={styles.search}
          placeholder="Rechercher (nom ou code)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        <button
          type="button"
          className={[styles.allOption, !value ? styles.optActive : ""].filter(Boolean).join(" ")}
          onClick={() => onPick(undefined)}
        >
          {placeholder}
        </button>

        {filtered ? (
          filtered.length ? (
            filtered.map((s) => <SetRow key={s.id} set={s} active={s.id === value} onPick={() => onPick(s.id)} />)
          ) : (
            <div className={styles.empty}>Aucune extension</div>
          )
        ) : (
          <>
            <div className={styles.groupTitle}>Récents</div>
            {recent.map((s) => (
              <SetRow key={`r-${s.id}`} set={s} active={s.id === value} onPick={() => onPick(s.id)} />
            ))}
            {groups.map((g) => {
              const key = g.seriesId ?? g.seriesName;
              const open = expanded.has(key);
              return (
                <div key={key}>
                  <button type="button" className={styles.groupHeader} onClick={() => toggleGroup(key)}>
                    <span>{g.seriesName}</span>
                    <span className={styles.groupCount}>
                      {g.sets.length}
                      <span className={[styles.caret, open ? styles.caretOpen : ""].join(" ")}>▾</span>
                    </span>
                  </button>
                  {open && g.sets.map((s) => <SetRow key={s.id} set={s} active={s.id === value} onPick={() => onPick(s.id)} />)}
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

export function SetPicker({ sets, value, onChange, placeholder }: SetPickerProps) {
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => sets.find((s) => s.id === value), [sets, value]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const pick = (id?: string) => {
    onChange(id);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      className={[styles.trigger, selected ? styles.hasValue : ""].filter(Boolean).join(" ")}
      onClick={() => setOpen((v) => !v)}
    >
      <span className={styles.triggerLabel}>{selected ? selected.name : placeholder}</span>
      <span className={styles.chevron}>▾</span>
    </button>
  );

  if (isMobile) {
    return (
      <div className={styles.wrap}>
        {trigger}
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Extension">
          <PickerContent sets={sets} value={value} placeholder={placeholder} onPick={pick} />
        </BottomSheet>
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {trigger}
      {open && (
        <div className={styles.popover}>
          <PickerContent sets={sets} value={value} placeholder={placeholder} onPick={pick} />
        </div>
      )}
    </div>
  );
}
