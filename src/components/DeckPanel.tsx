import { useState } from "react";
import { useDeckStore } from "../store/deckStore";
import { computeStats, groupByCategory, GROUP_LABEL, GROUP_ORDER } from "../lib/deckStats";
import type { DeckCard } from "../db/schema";
import { fr } from "../lib/i18n";
import { Icon } from "./ui/Icon";
import { DeckStats } from "./DeckStats";
import styles from "./DeckPanel.module.css";

type DeckTab = "list" | "stats";

function CardRow({ card }: { card: DeckCard }) {
  const setQty = useDeckStore((s) => s.setQty);
  return (
    <div className={styles.row}>
      <span className={styles.thumb}>
        {card.imageUrl ? <img src={card.imageUrl} alt="" loading="lazy" /> : <Icon name="cards" size={14} />}
      </span>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>{card.name}</span>
        {(card.setCode || card.number) && (
          <span className={styles.rowMeta}>
            {card.setCode?.toUpperCase()} {card.number}
          </span>
        )}
      </span>
      <span className={styles.stepper}>
        <button type="button" className={styles.minus} onClick={() => setQty(card.id, card.quantity - 1)} aria-label="Retirer">
          <Icon name="minus" size={14} />
        </button>
        <span className={styles.qty}>{card.quantity}</span>
        <button type="button" className={styles.plus} onClick={() => setQty(card.id, card.quantity + 1)} aria-label="Ajouter">
          <Icon name="plus" size={14} />
        </button>
      </span>
    </div>
  );
}

export function DeckPanel({ onClose, embedded }: { onClose?: () => void; embedded?: boolean }) {
  const cards = useDeckStore((s) => s.cards);
  const clearCards = useDeckStore((s) => s.clearCards);
  const [showWarnings, setShowWarnings] = useState(false);
  const [tab, setTab] = useState<DeckTab>("list");

  const stats = computeStats(cards);
  const groups = groupByCategory(cards);
  const pct = Math.min(100, Math.round((stats.total / 60) * 100));
  const complete = stats.total === 60;

  const clear = () => {
    if (cards.length === 0) return;
    if (confirm("Vider le deck ?")) clearCards();
  };

  return (
    <div className={styles.panel}>
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

      {cards.length > 0 && (
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

      <div className={styles.body}>
        {cards.length === 0 ? (
          <div className={styles.empty}>{fr.builder.emptyDeck}</div>
        ) : tab === "stats" ? (
          <DeckStats stats={stats} />
        ) : (
          GROUP_ORDER.filter((g) => groups[g].length > 0).map((g) => {
            const count = groups[g].reduce((s, c) => s + c.quantity, 0);
            return (
              <section key={g} className={styles.group}>
                <div className={styles.groupHead}>
                  {GROUP_LABEL[g]} · {count}
                </div>
                {groups[g].map((c) => (
                  <CardRow key={c.id} card={c} />
                ))}
              </section>
            );
          })
        )}
      </div>

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
