import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { searchCardsFullText } from "../api/ptcgProvider";
import { downloadBackup } from "../db/backup";
import { getLangPref, setLangPref } from "../lib/prefs";
import { useDebounce } from "../lib/useDebounce";
import { cardImg } from "../lib/img";
import { toast } from "../store/toastStore";
import { useCommandStore } from "../store/commandStore";
import type { CardBrief } from "../api/types";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/Icon";
import styles from "./CommandPalette.module.css";

interface Command {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  keywords?: string;
  run: () => void;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Écoute globale ⌘K / Ctrl+K ; monte le panneau (état neuf) à l'ouverture. */
export function CommandPalette() {
  const { open, setOpen, toggle } = useCommandStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && useCommandStore.getState().open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setOpen]);

  if (!open) return null;
  return <Palette onClose={() => setOpen(false)} />;
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const commands = useMemo<Command[]>(
    () => [
      { id: "nav-home", group: "Aller à", label: "Accueil", icon: "home", keywords: "home dashboard", run: () => go("/") },
      { id: "nav-cards", group: "Aller à", label: "Cartes", icon: "cards", keywords: "catalogue recherche", run: () => go("/cartes") },
      { id: "nav-decks", group: "Aller à", label: "Decks", icon: "decks", keywords: "mes decks builder", run: () => go("/decks") },
      { id: "nav-collection", group: "Aller à", label: "Collection", icon: "collection", keywords: "possede owned", run: () => go("/collection") },
      { id: "nav-analyse", group: "Aller à", label: "Analyse", icon: "chart", keywords: "stats statistiques", run: () => go("/analyse") },
      { id: "nav-reglages", group: "Aller à", label: "Réglages", icon: "settings", keywords: "settings parametres langue", run: () => go("/reglages") },
      { id: "act-new-deck", group: "Actions", label: "Nouveau deck", icon: "plus", keywords: "creer create deck", run: () => go("/decks?new=1") },
      {
        id: "act-export",
        group: "Actions",
        label: "Exporter mes données",
        icon: "sort",
        keywords: "sauvegarde backup export json",
        run: () => {
          void downloadBackup().then(() => toast("Sauvegarde exportée", "success"));
          onClose();
        },
      },
      {
        id: "act-lang",
        group: "Actions",
        label: "Basculer la langue des cartes (FR / EN)",
        icon: "cards",
        keywords: "langue language francais english",
        run: () => {
          const next = getLangPref() === "fr" ? "en" : "fr";
          setLangPref(next);
          void qc.invalidateQueries();
          toast(next === "fr" ? "Noms en français" : "Names in English", "success");
          onClose();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const filteredCommands = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return commands;
    return commands.filter((c) => norm(`${c.label} ${c.keywords ?? ""}`).includes(q));
  }, [commands, query]);

  // Recherche de cartes en direct (nom ou effet) via l'index.
  const debounced = useDebounce(query, 200);
  const [cards, setCards] = useState<CardBrief[]>([]);
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) return; // < 2 : rien à chercher (résultats masqués au rendu)
    let cancelled = false;
    void searchCardsFullText({ search: q, pageSize: 6 })
      .then((page) => !cancelled && setCards(page.items))
      .catch(() => !cancelled && setCards([]));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const showCards = query.trim().length >= 2;

  // Liste plate des entrées sélectionnables (navigation clavier).
  const flat = useMemo<(() => void)[]>(() => {
    const runs = filteredCommands.map((c) => c.run);
    if (showCards) {
      runs.push(() => go(`/cartes?q=${encodeURIComponent(query.trim())}`));
      for (const c of cards) runs.push(() => go(`/cartes?q=${encodeURIComponent(c.name)}`));
    }
    return runs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCommands, cards, query, showCards]);

  const activeIdx = flat.length ? Math.min(active, flat.length - 1) : 0;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIdx]?.();
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const groups = ["Aller à", "Actions"];
  const cardBase = filteredCommands.length; // index de « Rechercher … »

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Rechercher une carte, naviguer, agir…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.esc}>esc</kbd>
        </div>

        <div className={styles.list} ref={listRef}>
          {groups.map((g) => {
            const items = filteredCommands.filter((c) => c.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className={styles.group}>
                <div className={styles.groupLabel}>{g}</div>
                {items.map((c) => {
                  const i = filteredCommands.indexOf(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-idx={i}
                      className={[styles.item, i === activeIdx ? styles.itemActive : ""].join(" ")}
                      onMouseMove={() => setActive(i)}
                      onClick={() => c.run()}
                    >
                      <span className={styles.itemIcon}>
                        <Icon name={c.icon} size={16} />
                      </span>
                      <span className={styles.itemLabel}>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {showCards && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>Cartes</div>
              <button
                type="button"
                data-idx={cardBase}
                className={[styles.item, cardBase === activeIdx ? styles.itemActive : ""].join(" ")}
                onMouseMove={() => setActive(cardBase)}
                onClick={() => go(`/cartes?q=${encodeURIComponent(query.trim())}`)}
              >
                <span className={styles.itemIcon}>
                  <Icon name="search" size={16} />
                </span>
                <span className={styles.itemLabel}>Rechercher « {query.trim()} » dans les cartes</span>
              </button>
              {cards.map((c, j) => {
                const i = cardBase + 1 + j;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-idx={i}
                    className={[styles.item, i === activeIdx ? styles.itemActive : ""].join(" ")}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(`/cartes?q=${encodeURIComponent(c.name)}`)}
                  >
                    <span className={styles.thumb}>
                      {c.imageUrl ? <img src={cardImg(c.imageUrl, 90)} alt="" loading="lazy" /> : <Icon name="cards" size={14} />}
                    </span>
                    <span className={styles.itemLabel}>{c.displayName}</span>
                    {c.localId && <span className={styles.itemHint}>N° {c.localId}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {flat.length === 0 && <div className={styles.empty}>Aucun résultat.</div>}
        </div>

        <div className={styles.footer}>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> naviguer
          </span>
          <span>
            <kbd>↵</kbd> ouvrir
          </span>
          <span>
            <kbd>esc</kbd> fermer
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
