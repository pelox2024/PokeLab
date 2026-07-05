import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Deck, DeckVersion } from "../db/schema";
import { deleteDeck, duplicateDeck, updateDeckMeta } from "../db/decks";
import { useDeckStore } from "../store/deckStore";
import { deckTotal } from "../store/deckStore";
import { fr } from "../lib/i18n";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { CreateDeckModal } from "../components/CreateDeckModal";
import styles from "./MyDecks.module.css";

interface Summary {
  deck: Deck;
  version?: DeckVersion;
  total: number;
}

function relative(ts: number): string {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString("fr-FR");
}

export function MyDecks() {
  const navigate = useNavigate();
  const load = useDeckStore((s) => s.load);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();

  // Création pilotée depuis la palette de commandes (⌘K → /decks?new=1).
  const showCreate = creating || params.get("new") === "1";
  const closeCreate = () => {
    setCreating(false);
    if (params.get("new")) setParams({}, { replace: true });
  };

  const summaries = useLiveQuery<Summary[]>(async () => {
    const decks = await db.decks.orderBy("updatedAt").reverse().toArray();
    const versions = await db.versions.toArray();
    const firstByDeck = new Map<string, DeckVersion>();
    for (const v of versions) {
      if (!firstByDeck.has(v.deckId)) firstByDeck.set(v.deckId, v);
    }
    return decks.map((deck) => {
      const version = firstByDeck.get(deck.id);
      return { deck, version, total: version ? deckTotal(version.cards) : 0 };
    });
  }, []);

  const visible = useMemo(
    () => (summaries ?? []).filter((s) => !!s.deck.archived === showArchived),
    [summaries, showArchived],
  );
  const archivedCount = (summaries ?? []).filter((s) => s.deck.archived).length;

  const open = (s: Summary) => {
    if (!s.version) return;
    load({ deckId: s.deck.id, versionId: s.version.id, name: s.deck.name, format: s.deck.format, cards: s.version.cards });
    navigate("/builder");
  };

  const rename = async (s: Summary) => {
    const name = prompt(fr.myDecks.rename, s.deck.name);
    if (name && name.trim()) await updateDeckMeta(s.deck.id, { name: name.trim() });
  };

  const remove = async (s: Summary) => {
    if (confirm(fr.myDecks.confirmDelete)) await deleteDeck(s.deck.id);
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>
            <Icon name="decks" size={22} />
          </span>
          <div>
            <h1 className={styles.title}>{fr.nav.myDecks}</h1>
            <p className={styles.subtitle}>{fr.myDecks.subtitle}</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)} iconLeft={<Icon name="plus" size={16} />}>
          {fr.myDecks.create}
        </Button>
      </header>

      {archivedCount > 0 && (
        <div className={styles.tabs}>
          <button className={!showArchived ? styles.tabActive : styles.tab} onClick={() => setShowArchived(false)}>
            {fr.nav.myDecks}
          </button>
          <button className={showArchived ? styles.tabActive : styles.tab} onClick={() => setShowArchived(true)}>
            {fr.myDecks.archived} ({archivedCount})
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Icon name="decks" size={26} />}
          title={fr.myDecks.emptyTitle}
          body={fr.myDecks.emptyBody}
          action={
            <Button variant="primary" onClick={() => setCreating(true)} iconLeft={<Icon name="plus" size={16} />}>
              {fr.myDecks.create}
            </Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          {visible.map((s) => {
            const complete = s.total === 60;
            return (
              <div key={s.deck.id} className={styles.card}>
                <button type="button" className={styles.cardMain} onClick={() => open(s)}>
                  <div className={styles.cardTop}>
                    <span className={styles.deckName}>{s.deck.name}</span>
                    <span className={[styles.status, complete ? styles.statusOk : styles.statusWarn].join(" ")}>
                      {complete ? fr.myDecks.complete : fr.myDecks.incomplete}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.bigCount}>{s.total}</span>
                    <span className={styles.countMax}>/ 60 · {fr.format[s.deck.format]}</span>
                  </div>
                  <span className={styles.updated}>{fr.myDecks.updated(relative(s.deck.updatedAt))}</span>
                </button>
                <div className={styles.actions}>
                  <button type="button" onClick={() => rename(s)} title={fr.myDecks.rename}>
                    <Icon name="builder" size={15} />
                  </button>
                  <button type="button" onClick={() => duplicateDeck(s.deck.id)} title={fr.myDecks.duplicate}>
                    <Icon name="decks" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDeckMeta(s.deck.id, { archived: !s.deck.archived })}
                    title={s.deck.archived ? fr.myDecks.unarchive : fr.myDecks.archive}
                  >
                    <Icon name="empty" size={15} />
                  </button>
                  <button type="button" className={styles.del} onClick={() => remove(s)} title={fr.myDecks.delete}>
                    <Icon name="close" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateDeckModal open={showCreate} onClose={closeCreate} />
    </div>
  );
}
