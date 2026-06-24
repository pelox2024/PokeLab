import { useMemo, useState } from "react";
import type { DeckCard } from "../db/schema";
import type { SetInfo } from "../api/types";
import { buildDecklistText } from "../lib/deckExport";
import { parseDecklist } from "../lib/deckParser";
import { resolveDecklist } from "../api/decklistResolver";
import type { ResolvedLine } from "../api/decklistResolver";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import styles from "./ImportExportModal.module.css";

type Tab = "export" | "import";

interface Props {
  open: boolean;
  onClose: () => void;
  cards: DeckCard[];
  sets?: SetInfo[];
  onImport: (cards: DeckCard[]) => void;
}

export function ImportExportModal({ open, onClose, cards, sets, onImport }: Props) {
  const [tab, setTab] = useState<Tab>("export");
  const [importText, setImportText] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedLine[] | null>(null);
  const [unparsed, setUnparsed] = useState<string[]>([]);
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
    a.download = "deck-pokelab.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const analyze = async () => {
    const parsed = parseDecklist(importText);
    setUnparsed(parsed.unparsed);
    if (parsed.lines.length === 0) {
      setResolved([]);
      return;
    }
    setResolving(true);
    try {
      setResolved(await resolveDecklist(parsed.lines));
    } finally {
      setResolving(false);
    }
  };

  const doImport = () => {
    if (!resolved?.length) return;
    const deckCards: DeckCard[] = resolved.map((l) => ({
      id: l.cardId ?? `manual:${l.name}:${l.setCode ?? ""}:${l.number ?? ""}`,
      cardId: l.cardId,
      name: l.name,
      quantity: l.qty,
      category: l.category,
      setCode: l.setCode,
      number: l.number,
      imageUrl: l.imageUrl,
      manual: !l.resolved,
    }));
    if (cards.length > 0 && !confirm("Remplacer le deck actuel par cette decklist ?")) return;
    onImport(deckCards);
    reset();
    onClose();
  };

  const reset = () => {
    setImportText("");
    setResolved(null);
    setUnparsed([]);
  };

  const resolvedCount = resolved?.filter((l) => l.resolved).length ?? 0;
  const totalCards = resolved?.reduce((n, l) => n + l.qty, 0) ?? 0;
  const unresolved = resolved?.filter((l) => !l.resolved) ?? [];

  return (
    <Modal open={open} onClose={onClose} labelledBy="ioTitle" size="md">
      <h2 id="ioTitle" className={styles.title}>
        Import / Export
      </h2>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "export"}
          className={[styles.tab, tab === "export" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("export")}
        >
          <Icon name="sort" size={15} /> Exporter
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "import"}
          className={[styles.tab, tab === "import" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("import")}
        >
          <Icon name="plus" size={15} /> Importer
        </button>
      </div>

      {tab === "export" ? (
        <div className={styles.pane}>
          <p className={styles.hint}>
            Format PTCG Live / Limitless — collez-le dans « Importer un deck » de Pokémon TCG Live.
          </p>
          <textarea className={styles.area} value={exportText} readOnly spellCheck={false} rows={12} />
          <div className={styles.actions}>
            <Button variant="primary" onClick={copy} iconLeft={<Icon name={copied ? "spark" : "cards"} size={16} />}>
              {copied ? "Copié !" : "Copier"}
            </Button>
            <Button variant="ghost" onClick={download} iconLeft={<Icon name="decks" size={16} />}>
              Télécharger .txt
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.pane}>
          <p className={styles.hint}>
            Collez une decklist (PTCG Live, Limitless…) puis analysez-la avant d'importer.
          </p>
          <textarea
            className={styles.area}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"Pokémon: 12\n3 Charizard ex OBF 125\n..."}
            spellCheck={false}
            rows={9}
          />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={analyze} disabled={!importText.trim() || resolving}>
              {resolving ? "Analyse…" : "Analyser"}
            </Button>
            {resolved && (
              <Button variant="primary" onClick={doImport} disabled={!resolved.length} iconLeft={<Icon name="plus" size={16} />}>
                Importer {totalCards} cartes
              </Button>
            )}
          </div>

          {resolved && (
            <div className={styles.report}>
              <span className={styles.reportOk}>
                {resolvedCount}/{resolved.length} lignes reconnues
              </span>
              {unresolved.length > 0 && (
                <div className={styles.unresolved}>
                  <span className={styles.unresolvedTitle}>
                    <Icon name="alert" size={13} /> {unresolved.length} non résolues (importées en manuel) :
                  </span>
                  <ul>
                    {unresolved.slice(0, 8).map((l, i) => (
                      <li key={i}>{l.rawLine}</li>
                    ))}
                    {unresolved.length > 8 && <li>… +{unresolved.length - 8}</li>}
                  </ul>
                </div>
              )}
              {unparsed.length > 0 && (
                <div className={styles.unresolved}>
                  <span className={styles.unresolvedTitle}>{unparsed.length} ligne(s) ignorée(s)</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
