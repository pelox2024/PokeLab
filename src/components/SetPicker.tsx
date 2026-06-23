import { useEffect, useMemo, useRef, useState } from "react";
import type { SetInfo } from "../api/types";
import { Icon } from "./ui/Icon";
import styles from "./SetPicker.module.css";

interface SetPickerProps {
  sets: SetInfo[];
  value?: string;
  onChange: (id?: string) => void;
  placeholder: string;
}

export function SetPicker({ sets, value, onChange, placeholder }: SetPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => sets.find((s) => s.id === value), [sets, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    );
  }, [sets, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id?: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={[styles.trigger, selected ? styles.hasValue : ""].filter(Boolean).join(" ")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.triggerLabel}>{selected ? selected.name : placeholder}</span>
        <span className={styles.chevron}>▾</span>
      </button>

      {open && (
        <div className={styles.popover}>
          <div className={styles.searchRow}>
            <Icon name="search" size={15} />
            <input
              autoFocus
              className={styles.search}
              placeholder="Rechercher une extension…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.list}>
            <button
              type="button"
              className={[styles.option, !value ? styles.optActive : ""].filter(Boolean).join(" ")}
              onClick={() => pick(undefined)}
            >
              {placeholder}
            </button>
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className={[styles.option, s.id === value ? styles.optActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => pick(s.id)}
              >
                <span className={styles.optName}>{s.name}</span>
                <span className={styles.optId}>{s.id}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className={styles.empty}>Aucune extension</div>}
          </div>
        </div>
      )}
    </div>
  );
}
