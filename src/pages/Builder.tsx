import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { activeProvider } from "../api/cardApi";
import type { CardBrief, CardFilters, CardRecord, SortKey } from "../api/types";
import type { DeckFormat } from "../db/schema";
import { useSets } from "../hooks/useCards";
import { useCardExplorer } from "../hooks/useCardExplorer";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useDebounce } from "../lib/useDebounce";
import { createDeck, persistDeck } from "../db/decks";
import { useDeckStore } from "../store/deckStore";
import { fr } from "../lib/i18n";
import { CardGrid } from "../components/CardGrid";
import { FilterBar } from "../components/FilterBar";
import { DeckPanel } from "../components/DeckPanel";
import { CardDetailModal } from "../components/CardDetailModal";
import { ImportExportModal } from "../components/ImportExportModal";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { BottomSheet } from "../components/ui/BottomSheet";
import { Icon } from "../components/ui/Icon";
import styles from "./Builder.module.css";

const FORMAT_OPTIONS = [
  { value: "standard", label: fr.format.standard },
  { value: "expanded", label: fr.format.expanded },
  { value: "unlimited", label: fr.format.unlimited },
];

export function Builder() {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 980px)");

  const { deckId, versionId, name, format, cards, load, setName, setFormat, add, enrich, clearCards, replaceCards } =
    useDeckStore();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CardFilters>({});
  const [sort, setSort] = useState<SortKey>("set-recent");
  const [drawer, setDrawer] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const [ioOpen, setIoOpen] = useState(false);

  // Largeur du panneau d'ajout (redimensionnable, persistée).
  const EXPLORER_MIN = 320;
  const EXPLORER_MAX = 720;
  const [explorerW, setExplorerW] = useState(() => {
    const saved = Number(localStorage.getItem("pokelab.explorerW"));
    return saved >= EXPLORER_MIN && saved <= EXPLORER_MAX ? saved : 440;
  });
  const dragRef = useRef<{ x: number; w: number } | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(() => localStorage.getItem("pokelab.explorerOpen") !== "0");
  useEffect(() => {
    localStorage.setItem("pokelab.explorerOpen", explorerOpen ? "1" : "0");
  }, [explorerOpen]);

  const onResizeStart = (e: ReactPointerEvent) => {
    dragRef.current = { x: e.clientX, w: explorerW };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    // Le panneau est à droite : déplacer la poignée vers la gauche l'élargit.
    const next = dragRef.current.w - (e.clientX - dragRef.current.x);
    setExplorerW(Math.max(EXPLORER_MIN, Math.min(EXPLORER_MAX, next)));
  };
  const onResizeEnd = () => {
    if (dragRef.current) localStorage.setItem("pokelab.explorerW", String(explorerW));
    dragRef.current = null;
  };

  const debounced = useDebounce(search, 350);
  const { data: sets } = useSets();
  const { binderMode, sections, flatCards, count, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCardExplorer(debounced, filters, sort, sets, { excludePocket: true });

  const qtyByCard = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) m.set(c.cardId ?? c.id, c.quantity);
    return m;
  }, [cards]);

  // Auto-sauvegarde locale (debounced)
  useEffect(() => {
    if (!deckId || !versionId) return;
    const t = setTimeout(() => {
      void persistDeck(deckId, versionId, name, format, cards);
    }, 600);
    return () => clearTimeout(t);
  }, [deckId, versionId, name, format, cards]);

  // Ré-enrichissement de fond : les decks rechargés (ou anciens) peuvent manquer
  // de PV / types / suffixe → statistiques fausses. On complète chaque carte
  // TCGdex une fois par session (requête mise en cache, idempotente).
  const enrichRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const todo = cards.filter(
      (c) => c.cardId?.startsWith("tcgdex:") && !enrichRef.current.has(c.cardId),
    );
    if (todo.length === 0) return;
    let cancelled = false;
    for (const c of todo) enrichRef.current.add(c.cardId!);
    void Promise.all(
      todo.map(async (c) => {
        const pid = c.cardId!.slice(c.cardId!.indexOf(":") + 1);
        try {
          const rec = await queryClient.fetchQuery<CardRecord>({
            queryKey: ["cards", "detail", pid],
            queryFn: () => activeProvider.getCard(pid),
            staleTime: 30 * 60 * 1000,
          });
          if (cancelled) return;
          enrich(c.cardId!, {
            category: rec.category,
            setCode: rec.setId,
            number: rec.number,
            rarity: rec.rarity,
            subtypes: rec.subtypes,
            suffix: rec.suffix,
            hp: rec.hp,
            types: rec.types,
            imageUrl: rec.imageUrl ?? c.imageUrl,
          });
        } catch {
          /* best-effort */
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [cards, queryClient, enrich]);

  const addToDeck = async (brief: CardBrief) => {
    add({ cardId: brief.id, name: brief.name, number: brief.localId, imageUrl: brief.imageUrl });
    try {
      const rec = await queryClient.fetchQuery<CardRecord>({
        queryKey: ["cards", "detail", brief.providerId],
        queryFn: () => activeProvider.getCard(brief.providerId),
        staleTime: 30 * 60 * 1000,
      });
      enrich(brief.id, {
        category: rec.category,
        setCode: rec.setId,
        number: rec.number,
        rarity: rec.rarity,
        subtypes: rec.subtypes,
        suffix: rec.suffix,
        hp: rec.hp,
        types: rec.types,
        imageUrl: rec.imageUrl ?? brief.imageUrl,
      });
    } catch {
      /* enrichissement best-effort */
    }
  };

  const newDeck = async () => {
    const { deck, version } = await createDeck();
    load({ deckId: deck.id, versionId: version.id, name: deck.name, format: deck.format, cards: [] });
  };

  if (!deckId) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<Icon name="builder" size={26} />}
          title={fr.builder.noDeckTitle}
          body={fr.builder.noDeckBody}
          action={
            <Button variant="primary" onClick={newDeck} iconLeft={<Icon name="plus" size={16} />}>
              {fr.builder.create}
            </Button>
          }
        />
      </div>
    );
  }

  const explorer = (
    <div className={styles.explorer}>
      <Input
        sizeVariant="lg"
        iconLeft={<Icon name="search" size={20} />}
        placeholder={fr.cards.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        sets={sets}
        resultCount={count}
        hasMore={hasNextPage}
      />
      {isError ? (
        <EmptyState tone="danger" icon={<Icon name="alert" size={26} />} title={fr.states.errorTitle} body={fr.states.errorBody} />
      ) : isLoading ? (
        <CardGrid cards={[]} skeletonCount={18} size="compact" />
      ) : count === 0 && !hasNextPage ? (
        <EmptyState icon={<Icon name="empty" size={26} />} title={fr.states.emptyTitle} body={fr.states.emptyBody} />
      ) : (
        <CardGrid
          cards={binderMode ? undefined : flatCards}
          sections={binderMode ? sections : undefined}
          size="compact"
          rarityHint={filters.rarities}
          getQty={(c) => qtyByCard.get(c.id) ?? 0}
          onCardClick={addToDeck}
          loadingMore={isFetchingNextPage || (count === 0 && hasNextPage)}
          onReachEnd={fetchNextPage}
        />
      )}
    </div>
  );

  const deckHeader = (
    <header className={styles.deckHeader}>
      <Input className={styles.nameInput} value={name} onChange={(e) => setName(e.target.value)} aria-label={fr.builder.deckName} />
      <Select options={FORMAT_OPTIONS} value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)} aria-label={fr.builder.format} />
      <Button variant="ghost" size="md" onClick={newDeck} iconLeft={<Icon name="plus" size={16} />}>
        {fr.builder.newDeck}
      </Button>
      <Button variant="ghost" size="md" onClick={() => setIoOpen(true)} iconLeft={<Icon name="sort" size={16} />}>
        Import / Export
      </Button>
    </header>
  );

  const ioModal = (
    <ImportExportModal open={ioOpen} onClose={() => setIoOpen(false)} cards={cards} sets={sets} onImport={replaceCards} />
  );

  // --- Mobile : deck-first (le deck est l'écran principal) ---
  if (isMobile) {
    return (
      <div className={styles.page}>
        {deckHeader}
        <div className={styles.deckMain}>
          <DeckPanel embedded onInspect={setInspected} sets={sets} />
        </div>
        <div className={styles.addBar}>
          {cards.length > 0 && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => confirm("Vider le deck ?") && clearCards()}
              aria-label={fr.builder.clear}
            >
              <Icon name="close" size={18} />
            </button>
          )}
          <button type="button" className={styles.addBtn} onClick={() => setDrawer(true)}>
            <Icon name="plus" size={18} />
            {fr.builder.addCards}
          </button>
        </div>
        <BottomSheet open={drawer} onClose={() => setDrawer(false)} title={fr.builder.addCards}>
          {explorer}
        </BottomSheet>
        <CardDetailModal providerId={inspected} onClose={() => setInspected(null)} onSelectCard={setInspected} />
        {ioModal}
      </div>
    );
  }

  // --- Desktop : deck (héros) au centre + explorateur d'ajout redimensionnable ---
  return (
    <div className={styles.page}>
      <div
        className={styles.layout}
        data-collapsed={!explorerOpen}
        style={{ ["--explorer-w" as string]: `${explorerW}px` } as CSSProperties}
      >
        <section className={styles.deckZone}>
          {deckHeader}
          <div className={styles.deckCockpit}>
            <DeckPanel wide onInspect={setInspected} sets={sets} />
          </div>
        </section>

        {explorerOpen ? (
          <>
            <div
              className={styles.resizer}
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionner le panneau d'ajout"
            >
              <button
                type="button"
                className={styles.collapseBtn}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setExplorerOpen(false)}
                aria-label="Masquer le panneau d'ajout"
                title="Masquer"
              >
                <span className={styles.collapseGlyph}>›</span>
              </button>
              <span className={styles.resizerGrip} />
            </div>
            <aside className={styles.explorerPanel}>{explorer}</aside>
          </>
        ) : (
          <button type="button" className={styles.reopenTab} onClick={() => setExplorerOpen(true)}>
            <Icon name="plus" size={16} />
            <span>{fr.builder.addCards}</span>
          </button>
        )}
      </div>
      <CardDetailModal providerId={inspected} onClose={() => setInspected(null)} onSelectCard={setInspected} />
      {ioModal}
    </div>
  );
}
