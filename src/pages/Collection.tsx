import { useEffect, useMemo, useRef, useState } from "react";
import { adjustOwned, setOwned, useCollection } from "../db/collection";
import type { CollectionItem } from "../db/schema";
import type { SetInfo } from "../api/types";
import { useSets } from "../hooks/useCards";
import { fetchPokemontcgPricing } from "../api/pokemontcgPricing";
import { mapLimit } from "../api/deckEnrich";
import { useDebounce } from "../lib/useDebounce";
import { setRecencyValue } from "../lib/cardSort";
import { CardDetailModal } from "../components/CardDetailModal";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import { AnimatedNumber } from "../components/ui/AnimatedNumber";
import { ScrollTop } from "../components/ui/ScrollTop";
import styles from "./Collection.module.css";

function toProviderId(cardId?: string): string | undefined {
  if (!cardId || !cardId.startsWith("tcgdex:")) return undefined;
  return cardId.slice("tcgdex:".length);
}

function CollectionTile({ item, onInspect }: { item: CollectionItem; onInspect?: (pid: string) => void }) {
  const input = {
    cardId: item.cardId ?? item.id,
    name: item.name,
    setCode: item.setCode,
    number: item.number,
    imageUrl: item.imageUrl,
  };
  const providerId = toProviderId(item.cardId ?? item.id);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className={styles.tile}>
      <div
        className={styles.img}
        role={onInspect && providerId ? "button" : undefined}
        onClick={() => providerId && onInspect?.(providerId)}
        title={item.name}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.fallback}>
            <Icon name="cards" size={20} />
          </span>
        )}
        <span className={styles.qtyBadge}>×{item.quantity}</span>
        <div className={styles.bar} onClick={stop}>
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
          onClick={(e) => {
            stop(e);
            setOwned(input, 0);
          }}
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
  const { data: sets } = useSets();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const debounced = useDebounce(search, 250);

  const setLookup = useMemo(() => {
    const byId = new Map((sets ?? []).map((s) => [s.id, s]));
    const byCode = new Map((sets ?? []).filter((s) => s.ptcgoCode).map((s) => [s.ptcgoCode!.toUpperCase(), s]));
    return (code?: string) => (code ? byId.get(code) ?? byCode.get(code.toUpperCase()) : undefined);
  }, [sets]);

  // ---- Valeur estimée (Cardmarket via pokemontcg) ----
  const [value, setValue] = useState<number | null>(null);
  const [valState, setValState] = useState<"idle" | "loading" | "done">("idle");
  const valKey = useMemo(() => items.map((i) => `${i.id}:${i.quantity}`).join(","), [items]);
  const valFetched = useRef("");
  useEffect(() => {
    if (!sets || items.length === 0 || valFetched.current === valKey) return;
    valFetched.current = valKey;
    let cancelled = false;
    setValState("loading");
    void (async () => {
      let total = 0;
      await mapLimit(items, 5, async (it) => {
        const p = await fetchPokemontcgPricing({
          name: it.name,
          number: it.number,
          setName: setLookup(it.setCode)?.name,
        });
        if (cancelled) return;
        total += (p?.trend ?? p?.avg ?? p?.low ?? 0) * it.quantity;
      });
      if (cancelled) return;
      setValue(total);
      setValState("done");
    })();
    return () => {
      cancelled = true;
    };
  }, [items, valKey, sets, setLookup]);

  // ---- Complétion par extension ----
  const completion = useMemo(() => {
    if (!sets) return [] as { set: SetInfo; owned: number }[];
    const map = new Map<string, { set: SetInfo; owned: number }>();
    for (const it of items) {
      const set = setLookup(it.setCode);
      if (!set?.cardCount) continue;
      const e = map.get(set.id) ?? { set, owned: 0 };
      e.owned += 1; // 1 entrée = 1 carte distincte possédée
      map.set(set.id, e);
    }
    return [...map.values()].sort((a, b) => setRecencyValue(b.set) - setRecencyValue(a.set)).slice(0, 12);
  }, [items, sets, setLookup]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.setCode?.toLowerCase().includes(q),
    );
  }, [items, debounced]);

  const totalCards = items.reduce((n, i) => n + i.quantity, 0);
  const distinct = items.length;
  const setCount = new Set(items.map((i) => i.setCode).filter(Boolean)).size;

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
            <span className={styles.statNum}>
              <AnimatedNumber value={totalCards} />
            </span>
            <span className={styles.statLabel}>cartes au total</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>
              <AnimatedNumber value={distinct} />
            </span>
            <span className={styles.statLabel}>cartes distinctes</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>
              <AnimatedNumber value={setCount} />
            </span>
            <span className={styles.statLabel}>extensions</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statNum}>
              {valState === "done" && value != null ? (
                <AnimatedNumber value={value} format={(n) => `${Math.round(n)} €`} />
              ) : valState === "loading" ? (
                "…"
              ) : (
                "—"
              )}
            </span>
            <span className={styles.statLabel}>valeur estimée</span>
          </div>
        </div>
      )}

      {completion.length > 0 && (
        <section className={styles.completion}>
          <span className={styles.sectionTitle}>Complétion par extension</span>
          <div className={styles.compGrid}>
            {completion.map(({ set, owned }) => {
              const pct = Math.min(100, Math.round((owned / (set.cardCount || 1)) * 100));
              return (
                <div key={set.id} className={styles.compRow}>
                  <div className={styles.compHead}>
                    <span className={styles.compName}>{set.name}</span>
                    <span className={styles.compVal}>
                      {owned}/{set.cardCount} · {pct}%
                    </span>
                  </div>
                  <div className={styles.compBar}>
                    <span className={styles.compFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
                <CollectionTile key={item.id} item={item} onInspect={setSelected} />
              ))}
            </div>
          )}
        </>
      )}

      <CardDetailModal providerId={selected} onClose={() => setSelected(null)} onSelectCard={setSelected} />
      <ScrollTop />
    </div>
  );
}
