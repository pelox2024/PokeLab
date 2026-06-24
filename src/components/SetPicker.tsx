import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SetInfo } from "../api/types";
import { setRecencyValue } from "../lib/cardSort";
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
  return setRecencyValue(b) - setRecencyValue(a); // plus récent d'abord
}

function setYear(s: SetInfo): string | undefined {
  return s.releaseDate ? s.releaseDate.slice(0, 4) : undefined;
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
  for (const g of groups) g.sets.sort(sortSets);
  // Série ordonnée par son set le plus récent
  groups.sort((a, b) => setRecencyValue(b.sets[0]) - setRecencyValue(a.sets[0]));
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
          {setYear(set) ? `${setYear(set)} · ` : ""}
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
  autoFocus,
}: {
  sets: SetInfo[];
  value?: string;
  placeholder: string;
  onPick: (id?: string) => void;
  autoFocus?: boolean;
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
          autoFocus={autoFocus}
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

interface PopRect {
  top: number;
  left: number;
  width: number;
}

export function SetPicker({ sets, value, onChange, placeholder }: SetPickerProps) {
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<PopRect | null>(null);

  const selected = useMemo(() => sets.find((s) => s.id === value), [sets, value]);

  // Positionne le popover (desktop) en coordonnées viewport : il est rendu dans
  // un portal sur <body> pour échapper au `overflow:hidden` du panneau filtres.
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const place = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 24);
      // Cale le popover sous le trigger, sans déborder à droite de l'écran.
      const left = Math.min(r.left, window.innerWidth - width - 12);
      setRect({ top: r.bottom + 6, left: Math.max(12, left), width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
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
      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            className={styles.popover}
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            <PickerContent sets={sets} value={value} placeholder={placeholder} onPick={pick} autoFocus />
          </div>,
          document.body,
        )}
    </div>
  );
}
