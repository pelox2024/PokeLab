import { useMemo, useState } from "react";
import type { DeckCard } from "../db/schema";
import type { SetInfo } from "../api/types";
import { buildDecklistText } from "../lib/deckExport";
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

/** Export / partage d'un deck terminé (texte PTCG Live, presse-papier, .txt). */
export function ExportModal({ open, onClose, cards, sets, deckName }: Props) {
  const [copied, setCopied] = useState(false);
  const exportText = useMemo(() => buildDecklistText(cards, sets), [cards, sets]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
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
      <h2 id="exportTitle" className={styles.title}>
        Exporter / Partager
      </h2>
      <div className={styles.pane}>
        <p className={styles.hint}>
          Format PTCG Live / Limitless — collez-le dans « Importer un deck » de Pokémon TCG Live.
        </p>
        <textarea className={styles.area} value={exportText} readOnly spellCheck={false} rows={12} />
        <div className={styles.actions}>
          <Button variant="primary" onClick={copy} iconLeft={<Icon name={copied ? "spark" : "cards"} size={16} />}>
            {copied ? "Copié !" : "Copier la liste"}
          </Button>
          <Button variant="ghost" onClick={download} iconLeft={<Icon name="decks" size={16} />}>
            Télécharger .txt
          </Button>
        </div>
      </div>
    </Modal>
  );
}
