import { useMemo, useState } from "react";
import type { DeckCard } from "../db/schema";
import type { SetInfo } from "../api/types";
import { buildDecklistText } from "../lib/deckExport";
import { useOwnedMap } from "../db/collection";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import styles from "./deckModals.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  cards: DeckCard[];
  sets?: SetInfo[];
  deckName?: string;
}

type Tab = "list" | "missing";

const cmLink = (name: string) =>
  `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}`;

/** Export / partage d'un deck : decklist PTCG Live + liste des cartes manquantes. */
export function ExportModal({ open, onClose, cards, sets, deckName }: Props) {
  const [tab, setTab] = useState<Tab>("list");
  const [copied, setCopied] = useState<"list" | "missing" | null>(null);
  const owned = useOwnedMap();

  const exportText = useMemo(() => buildDecklistText(cards, sets), [cards, sets]);

  const missing = useMemo(() => {
    return cards
      .map((c) => {
        const have = owned.get(c.cardId ?? c.id) ?? 0;
        const need = Math.max(0, c.quantity - have);
        return need > 0 ? { card: c, need } : null;
      })
      .filter((x): x is { card: DeckCard; need: number } => x !== null);
  }, [cards, owned]);

  const missingText = useMemo(
    () =>
      missing
        .map(({ card, need }) => {
          const set = card.setCode ? ` ${card.setCode.toUpperCase()}${card.number ? ` ${card.number}` : ""}` : "";
          return `${need} ${card.name}${set}`;
        })
        .join("\n"),
    [missing],
  );
  const missingTotal = missing.reduce((n, m) => n + m.need, 0);

  const copy = async (text: string, which: "list" | "missing") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard indisponible */
    }
  };

  const download = () => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(deckName || "deck").replace(/[^\w-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="exportTitle" size="md">
      <div className={styles.content}>
        <h2 id="exportTitle" className={styles.title}>
          Exporter / Partager
        </h2>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "list"}
            className={[styles.tab, tab === "list" ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab("list")}
          >
            <Icon name="decks" size={15} /> Decklist
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "missing"}
            className={[styles.tab, tab === "missing" ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab("missing")}
          >
            <Icon name="cards" size={15} /> Manquantes{missingTotal > 0 ? ` · ${missingTotal}` : ""}
          </button>
        </div>

        {tab === "list" ? (
          <div className={styles.pane}>
            <p className={styles.hint}>
              Format PTCG Live / Limitless — collez-le dans « Importer un deck » de Pokémon TCG Live.
            </p>
            <textarea className={styles.area} value={exportText} readOnly spellCheck={false} rows={11} />
            <div className={styles.actions}>
              <Button variant="primary" onClick={() => copy(exportText, "list")} iconLeft={<Icon name={copied === "list" ? "spark" : "cards"} size={16} />}>
                {copied === "list" ? "Copié !" : "Copier la liste"}
              </Button>
              <Button variant="ghost" onClick={download} iconLeft={<Icon name="decks" size={16} />}>
                Télécharger .txt
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.pane}>
            <p className={styles.hint}>
              Cartes qu'il te manque (requis − possédé). Marque tes cartes possédées depuis la fiche détaillée.
            </p>
            {missing.length === 0 ? (
              <div className={styles.report}>
                <span className={styles.reportOk}>
                  <Icon name="spark" size={14} /> Tu possèdes toutes les cartes de ce deck.
                </span>
              </div>
            ) : (
              <>
                <div className={styles.missingList}>
                  {missing.map(({ card, need }) => (
                    <div key={card.id} className={styles.missingRow}>
                      <span className={styles.missingNeed}>{need}×</span>
                      <span className={styles.missingName}>{card.name}</span>
                      <a className={styles.cmLink} href={cmLink(card.name)} target="_blank" rel="noopener noreferrer">
                        <Icon name="search" size={13} /> Cardmarket
                      </a>
                    </div>
                  ))}
                </div>
                <div className={styles.actions}>
                  <Button variant="primary" onClick={() => copy(missingText, "missing")} iconLeft={<Icon name={copied === "missing" ? "spark" : "cards"} size={16} />}>
                    {copied === "missing" ? "Copié !" : `Copier les ${missingTotal} manquantes`}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
