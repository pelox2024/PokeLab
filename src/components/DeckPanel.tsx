import { useEffect, useState } from "react";
import { useDeckStore } from "../store/deckStore";
import { buildDeckGroups, computeStats } from "../lib/deckStats";
import type { DeckSortKey } from "../lib/deckStats";
import type { DeckCard } from "../db/schema";
import type { SetInfo } from "../api/types";
import { fr } from "../lib/i18n";
import { Icon } from "./ui/Icon";
import { Select } from "./ui/Select";
import { DeckStats } from "./DeckStats";
import styles from "./DeckPanel.module.css";

type DeckTab = "list" | "stats";
type DeckView = "grid" | "stacks" | "list";

const SORT_OPTIONS: { value: DeckSortKey; label: string }[] = [
  { value: "type", label: "Par type" },
  { value: "set", label: "Par extension" },
  { value: "series", label: "Par série" },
  { value: "name", label: "Nom (A→Z)" },
  { value: "hp", label: "PV" },
  { value: "rarity", label: "Rareté" },
  { value: "qty", label: "Quantité" },
];

/** providerId TCGdex ("sv08-001") depuis l'id global. `undefined` pour les
 *  cartes non-TCGdex (importées/manuelles) → pas de détail (évite l'erreur). */
function toProviderId(cardId?: string): string | undefined {
  if (!cardId || !cardId.startsWith("tcgdex:")) return undefined;
  return cardId.slice("tcgdex:".length);
}

/** Tuile visuelle d'une carte du deck (vues "grille" et "piles"). Contrôles au
 *  survol (− qté +, retirer) ; clic sur l'image → détails. Sur tactile, les
 *  contrôles restent visibles. */
function DeckCardTile({
  card,
  view,
  onInspect,
}: {
  card: DeckCard;
  view: DeckView;
  onInspect?: (pid: string) => void;
}) {
  const setQty = useDeckStore((s) => s.setQty);
  const providerId = toProviderId(card.cardId);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const stacked = view === "stacks" && card.quantity > 1;

  return (
    <div className={styles.pile}>
      <div
        className={[styles.pileImg, stacked ? styles.stacked : ""].filter(Boolean).join(" ")}
        role={onInspect && providerId ? "button" : undefined}
        onClick={() => providerId && onInspect?.(providerId)}
        title={card.name}
      >
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.pileFallback}>
            <Icon name="cards" size={18} />
          </span>
        )}
        <span className={styles.pileQty}>×{card.quantity}</span>
        <button
          type="button"
          className={styles.pileRemove}
          onClick={(e) => {
            stop(e);
            setQty(card.id, 0);
          }}
          aria-label="Retirer la carte"
          title="Retirer"
        >
          <Icon name="close" size={12} />
        </button>
        <div className={styles.pileBar} onClick={stop}>
          <button type="button" className={styles.pileMinus} onClick={() => setQty(card.id, card.quantity - 1)} aria-label="Moins">
            <Icon name="minus" size={13} />
          </button>
          <span className={styles.pileBarQty}>{card.quantity}</span>
          <button type="button" className={styles.pilePlus} onClick={() => setQty(card.id, card.quantity + 1)} aria-label="Plus">
            <Icon name="plus" size={13} />
          </button>
        </div>
      </div>
      <span className={styles.pileName}>{card.name}</span>
    </div>
  );
}

/** Ligne compacte (vue "liste") : peu de visuel, dense. */
function DeckListRow({ card, onInspect }: { card: DeckCard; onInspect?: (pid: string) => void }) {
  const setQty = useDeckStore((s) => s.setQty);
  const providerId = toProviderId(card.cardId);
  return (
    <div className={styles.listRow}>
      <span className={styles.listQty}>{card.quantity}</span>
      <button
        type="button"
        className={styles.listMain}
        onClick={() => providerId && onInspect?.(providerId)}
        title={card.name}
      >
        <span className={styles.listThumb}>
          {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" /> : <Icon name="cards" size={12} />}
        </span>
        <span className={styles.listName}>{card.name}</span>
        {(card.setCode || card.number) && (
          <span className={styles.listMeta}>
            {card.setCode?.toUpperCase()} {card.number}
          </span>
        )}
      </button>
      <span className={styles.listStepper}>
        <button type="button" onClick={() => setQty(card.id, card.quantity - 1)} aria-label="Moins">
          <Icon name="minus" size={13} />
        </button>
        <button type="button" onClick={() => setQty(card.id, card.quantity + 1)} aria-label="Plus">
          <Icon name="plus" size={13} />
        </button>
      </span>
    </div>
  );
}

export function DeckPanel({
  onClose,
  embedded,
  onInspect,
  wide,
  sets,
}: {
  onClose?: () => void;
  embedded?: boolean;
  onInspect?: (providerId: string) => void;
  /** Disposition large : tuiles du deck et statistiques affichées côte à côte. */
  wide?: boolean;
  /** Extensions (pour les regroupements par Set / Série). */
  sets?: SetInfo[];
}) {
  const cards = useDeckStore((s) => s.cards);
  const clearCards = useDeckStore((s) => s.clearCards);
  const [showWarnings, setShowWarnings] = useState(false);
  const [tab, setTab] = useState<DeckTab>("list");
  const [view, setView] = useState<DeckView>(() => (localStorage.getItem("pokelab.deckView") as DeckView) || "grid");
  const [deckSort, setDeckSort] = useState<DeckSortKey>(() => (localStorage.getItem("pokelab.deckSort") as DeckSortKey) || "type");

  useEffect(() => localStorage.setItem("pokelab.deckView", view), [view]);
  useEffect(() => localStorage.setItem("pokelab.deckSort", deckSort), [deckSort]);

  const stats = computeStats(cards);
  const deckGroups = buildDeckGroups(cards, deckSort, { sets });
  const pct = Math.min(100, Math.round((stats.total / 60) * 100));
  const complete = stats.total === 60;

  const clear = () => {
    if (cards.length === 0) return;
    if (confirm("Vider le deck ?")) clearCards();
  };

  const VIEW_BTNS: { value: DeckView; icon: "cards" | "decks" | "menu"; label: string }[] = [
    { value: "grid", icon: "cards", label: "Grille" },
    { value: "stacks", icon: "decks", label: "Piles" },
    { value: "list", icon: "menu", label: "Liste" },
  ];

  const deckToolbar = (
    <div className={styles.toolbar}>
      <div className={styles.viewSwitch} role="group" aria-label="Mode d'affichage">
        {VIEW_BTNS.map((v) => (
          <button
            key={v.value}
            type="button"
            className={[styles.viewBtn, view === v.value ? styles.viewBtnActive : ""].join(" ")}
            onClick={() => setView(v.value)}
            aria-pressed={view === v.value}
            title={v.label}
          >
            <Icon name={v.icon} size={15} />
          </button>
        ))}
      </div>
      <Select
        className={styles.sortSelect}
        options={SORT_OPTIONS}
        value={deckSort}
        onChange={(e) => setDeckSort(e.target.value as DeckSortKey)}
        aria-label="Trier le deck"
      />
    </div>
  );

  const deckContent = deckGroups.map((g) => (
    <section key={g.key} className={styles.group}>
      <div className={styles.groupHead}>
        {g.label} · {g.count}
      </div>
      {view === "list" ? (
        <div className={styles.listRows}>
          {g.cards.map((c) => (
            <DeckListRow key={c.id} card={c} onInspect={onInspect} />
          ))}
        </div>
      ) : (
        <div className={view === "stacks" ? styles.stackGrid : styles.pileGrid}>
          {g.cards.map((c) => (
            <DeckCardTile key={c.id} card={c} view={view} onInspect={onInspect} />
          ))}
        </div>
      )}
    </section>
  ));

  return (
    <div className={[styles.panel, embedded ? styles.panelFlow : ""].filter(Boolean).join(" ")}>
      <header className={styles.head}>
        {!embedded && (
          <div className={styles.headTop}>
            <span className={styles.headTitle}>{fr.builder.currentDeck}</span>
            {onClose && (
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        )}
        <div className={styles.totalRow}>
          <span className={[styles.total, complete ? styles.totalOk : ""].join(" ")}>{stats.total}</span>
          <span className={styles.totalMax}>/ 60</span>
          <span className={styles.miniStats}>
            <span title={fr.category.pokemon}>{stats.pokemon} P</span>
            <span title={fr.category.trainer}>{stats.trainer} D</span>
            <span title={fr.category.energy}>{stats.energy} É</span>
          </span>
        </div>
        <div className={styles.bar}>
          <span className={[styles.barFill, complete ? styles.barOk : ""].join(" ")} style={{ width: `${pct}%` }} />
        </div>
        {stats.warnings.length > 0 && (
          <button type="button" className={styles.warnToggle} onClick={() => setShowWarnings((v) => !v)}>
            <Icon name="alert" size={14} />
            {fr.builder.seeErrors} ({stats.warnings.length})
          </button>
        )}
        {showWarnings && (
          <ul className={styles.warnList}>
            {stats.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </header>

      {!wide && cards.length > 0 && (
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "list"}
            className={[styles.tab, tab === "list" ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab("list")}
          >
            <Icon name="decks" size={14} />
            {fr.builder.tabList}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "stats"}
            className={[styles.tab, tab === "stats" ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab("stats")}
          >
            <Icon name="chart" size={14} />
            {fr.builder.tabStats}
          </button>
        </div>
      )}

      {cards.length === 0 ? (
        <div className={styles.body}>
          <div className={styles.empty}>{fr.builder.emptyDeck}</div>
        </div>
      ) : wide ? (
        <div className={styles.wide}>
          <div className={styles.wideList}>
            {deckToolbar}
            {deckContent}
          </div>
          <aside className={styles.wideStats}>
            <DeckStats stats={stats} />
          </aside>
        </div>
      ) : (
        <div className={styles.body}>
          {tab === "stats" ? (
            <DeckStats stats={stats} />
          ) : (
            <>
              {deckToolbar}
              {deckContent}
            </>
          )}
        </div>
      )}

      {cards.length > 0 && !embedded && (
        <footer className={styles.footer}>
          <button type="button" className={styles.clearBtn} onClick={clear}>
            <Icon name="close" size={14} />
            {fr.builder.clear}
          </button>
        </footer>
      )}
    </div>
  );
}
