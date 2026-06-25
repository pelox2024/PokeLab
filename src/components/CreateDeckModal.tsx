import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDeck } from "../db/decks";
import { useDeckStore } from "../store/deckStore";
import { useSets } from "../hooks/useCards";
import type { DeckCard, DeckFormat } from "../db/schema";
import { parseDecklist } from "../lib/deckParser";
import { resolveDecklist } from "../api/decklistResolver";
import type { ResolvedLine, ResolveStrategy } from "../api/decklistResolver";
import { fr } from "../lib/i18n";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Icon } from "./ui/Icon";
import styles from "./deckModals.module.css";

type Tab = "create" | "import";

const FORMAT_OPTIONS = [
  { value: "standard", label: fr.format.standard },
  { value: "expanded", label: fr.format.expanded },
  { value: "unlimited", label: fr.format.unlimited },
];

const STRATEGY_OPTIONS: { value: ResolveStrategy; label: string }[] = [
  { value: "latest", label: "Impression la plus récente" },
  { value: "cheapest", label: "La moins chère" },
  { value: "priciest", label: "La plus chère" },
  { value: "exact", label: "Exacte (set + n° uniquement)" },
];

export function CreateDeckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const load = useDeckStore((s) => s.load);
  const { data: sets } = useSets();

  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("Nouveau deck");
  const [format, setFormat] = useState<DeckFormat>("standard");
  const [importText, setImportText] = useState("");
  const [strategy, setStrategy] = useState<ResolveStrategy>("latest");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedLine[] | null>(null);
  const [unparsed, setUnparsed] = useState<string[]>([]);

  const reset = () => {
    setName("Nouveau deck");
    setFormat("standard");
    setImportText("");
    setResolved(null);
    setUnparsed([]);
    setTab("create");
  };

  const close = () => {
    reset();
    onClose();
  };

  const go = async (cards: DeckCard[]) => {
    const { deck, version } = await createDeck(name.trim() || "Nouveau deck", format);
    load({ deckId: deck.id, versionId: version.id, name: deck.name, format, cards });
    close();
    navigate("/builder");
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
      setResolved(await resolveDecklist(parsed.lines, { sets, strategy }));
    } finally {
      setResolving(false);
    }
  };

  const doImport = async () => {
    if (!resolved?.length) return;
    const cards: DeckCard[] = resolved.map((l) => ({
      id: l.cardId ?? `manual:${l.name}:${l.setCode ?? ""}:${l.number ?? ""}`,
      cardId: l.cardId,
      name: l.name,
      quantity: l.qty,
      category: l.category,
      setCode: l.setCode,
      number: l.number,
      imageUrl: l.imageUrl,
      rarity: l.rarity,
      subtypes: l.subtypes,
      suffix: l.suffix,
      hp: l.hp,
      types: l.types,
      manual: !l.resolved,
    }));
    await go(cards);
  };

  const resolvedCount = resolved?.filter((l) => l.resolved).length ?? 0;
  const approxCount = resolved?.filter((l) => l.approx).length ?? 0;
  const totalCards = resolved?.reduce((n, l) => n + l.qty, 0) ?? 0;
  const unresolved = resolved?.filter((l) => !l.resolved) ?? [];

  return (
    <Modal open={open} onClose={close} labelledBy="createTitle" size="md">
      <div className={styles.content}>
      <h2 id="createTitle" className={styles.title}>
        Créer un deck
      </h2>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create"}
          className={[styles.tab, tab === "create" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("create")}
        >
          <Icon name="plus" size={15} /> Créer
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "import"}
          className={[styles.tab, tab === "import" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("import")}
        >
          <Icon name="sort" size={15} /> Importer
        </button>
      </div>

      <div className={styles.pane}>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nom du deck</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau deck" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Format</span>
            <Select options={FORMAT_OPTIONS} value={format} onChange={(e) => setFormat(e.target.value as DeckFormat)} />
          </label>
        </div>

        {tab === "create" ? (
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => go([])} iconLeft={<Icon name="builder" size={16} />}>
              Créer le deck
            </Button>
          </div>
        ) : (
          <>
            <p className={styles.hint}>Collez une decklist (PTCG Live, Limitless…) puis analysez-la.</p>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Cartes introuvables → choisir</span>
              <Select
                options={STRATEGY_OPTIONS}
                value={strategy}
                onChange={(e) => {
                  setStrategy(e.target.value as ResolveStrategy);
                  setResolved(null);
                }}
              />
            </label>
            <textarea
              className={styles.area}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Pokémon: 12\n3 Charizard ex OBF 125\n..."}
              spellCheck={false}
              rows={8}
            />
            <div className={styles.actions}>
              <Button variant="ghost" onClick={analyze} disabled={!importText.trim() || resolving}>
                {resolving ? "Analyse…" : "Analyser"}
              </Button>
              {resolved && (
                <Button variant="primary" onClick={doImport} disabled={!resolved.length} iconLeft={<Icon name="plus" size={16} />}>
                  Créer &amp; importer {totalCards} cartes
                </Button>
              )}
            </div>
            {resolved && (
              <div className={styles.report}>
                <span className={styles.reportOk}>
                  {resolvedCount}/{resolved.length} lignes reconnues
                  {approxCount > 0 ? ` · ${approxCount} par nom` : ""}
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
          </>
        )}
      </div>
      </div>
    </Modal>
  );
}
