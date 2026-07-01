import { useMemo, useState } from "react";
import { adjustOwned, setOwned, useCollection } from "../db/collection";
import type { CollectionItem } from "../db/schema";
import { useDebounce } from "../lib/useDebounce";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import styles from "./Collection.module.css";

function CollectionTile({ item }: { item: CollectionItem }) {
  const input = {
    cardId: item.cardId ?? item.id,
    name: item.name,
    setCode: item.setCode,
    number: item.number,
    imageUrl: item.imageUrl,
  };
  return (
    <div className={styles.tile}>
      <div className={styles.img}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.fallback}>
            <Icon name="cards" size={20} />
          </span>
        )}
        <span className={styles.qtyBadge}>×{item.quantity}</span>
        <div className={styles.bar}>
          <button type="button" onClick={() => adjustOwned(input, -1)} aria-label="Moins">
            <Icon name="minus" size={13} />
          </button>
          <span className={styles.barQty}>{item.quantity}</span>
          <button type="button" onClick={() => adjustOwned(input, 1)} aria-label="Plus">
            <Icon name="plus" size={13} />
          </button>
        </div>
        <button
          type="button"
          className={styles.remove}
          onClick={() => setOwned(input, 0)}
          aria-label="Retirer"
          title="Retirer de la collection"
        >
          <Icon name="close" size={12} />
        </button>
      </div>
      <span className={styles.name}>{item.name}</span>
      {(item.setCode || item.number) && (
        <span className={styles.meta}>
          {item.setCode?.toUpperCase()} {item.number}
        </span>
      )}
    </div>
  );
}

export function Collection() {
  const items = useCollection();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.setCode?.toLowerCase().includes(q),
    );
  }, [items, debounced]);

  const totalCards = items.reduce((n, i) => n + i.quantity, 0);
  const distinct = items.length;
  const sets = new Set(items.map((i) => i.setCode).filter(Boolean)).size;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>
          <Logo size={14} /> Ma collection
        </span>
        <h1 className={styles.title}>Ma collection</h1>
        <p className={styles.subtitle}>
          Les cartes que tu possèdes, saisies depuis la page Cartes ou la fiche d'une carte.
        </p>
      </header>

      {items.length > 0 && (
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{totalCards}</span>
            <span className={styles.statLabel}>cartes au total</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{distinct}</span>
            <span className={styles.statLabel}>cartes distinctes</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>{sets}</span>
            <span className={styles.statLabel}>extensions</span>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon name="cards" size={26} />}
          title="Collection vide"
          body="Ajoute des cartes depuis la page Cartes (bouton + au survol) ou la fiche détaillée d'une carte."
        />
      ) : (
        <>
          <Input
            sizeVariant="lg"
            iconLeft={<Icon name="search" size={20} />}
            placeholder="Rechercher dans ma collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.length === 0 ? (
            <EmptyState icon={<Icon name="empty" size={26} />} title="Aucun résultat" body="Aucune carte ne correspond à cette recherche." />
          ) : (
            <div className={styles.grid}>
              {filtered.map((item) => (
                <CollectionTile key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
