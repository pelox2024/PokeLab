import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Deck, DeckCard, DeckVersion } from "../db/schema";
import { computeStats } from "../lib/deckStats";
import { fetchEnrichment, mapLimit, needsEnrichment } from "../api/deckEnrich";
import { useOwnedMap } from "../db/collection";
import { fr } from "../lib/i18n";
import { DeckStats } from "../components/DeckStats";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import { AnimatedNumber } from "../components/ui/AnimatedNumber";
import styles from "./Analysis.module.css";

interface DeckRow {
  deck: Deck;
  version?: DeckVersion;
}

type TipTone = "ok" | "warn" | "danger";

export function Analysis() {
  const owned = useOwnedMap();

  const decks = useLiveQuery<DeckRow[]>(async () => {
    const all = await db.decks.orderBy("updatedAt").reverse().toArray();
    const versions = await db.versions.toArray();
    const firstByDeck = new Map<string, DeckVersion>();
    for (const v of versions) if (!firstByDeck.has(v.deckId)) firstByDeck.set(v.deckId, v);
    return all.filter((d) => !d.archived).map((deck) => ({ deck, version: firstByDeck.get(deck.id) }));
  }, []);

  const [deckId, setDeckId] = useState<string | null>(null);
  const selected = useMemo(
    () => decks?.find((d) => d.deck.id === deckId) ?? decks?.[0],
    [decks, deckId],
  );

  // Enrichissement (PV/types/sous-types) mémorisé par carte pour des stats justes.
  // Clé « deckId:cardId » : pas de reset synchrone au changement de deck (lint-safe).
  const [patches, setPatches] = useState<Record<string, Partial<DeckCard>>>({});
  const deckKey = selected?.deck.id ?? "";

  const cards = useMemo<DeckCard[]>(() => {
    const base = selected?.version?.cards ?? [];
    return base.map((c) => {
      const patch = c.cardId ? patches[`${deckKey}:${c.cardId}`] : undefined;
      return patch ? { ...c, ...patch } : c;
    });
  }, [selected?.version?.cards, patches, deckKey]);

  const enrichRef = useRef<string>("");
  useEffect(() => {
    const base = selected?.version?.cards ?? [];
    const key = selected?.deck.id ?? "";
    if (base.length === 0 || enrichRef.current === key) return;
    enrichRef.current = key;
    let cancelled = false;
    const done = new Set<string>();
    void (async () => {
      const todo = base.filter((c) => c.cardId && needsEnrichment(c) && !done.has(c.cardId));
      await mapLimit(todo, 6, async (c) => {
        done.add(c.cardId!);
        const patch = await fetchEnrichment(c.cardId!);
        if (cancelled || !patch) return;
        setPatches((prev) => ({ ...prev, [`${key}:${c.cardId}`]: patch }));
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.deck.id, selected?.version?.id, selected?.version?.cards]);

  const stats = useMemo(() => computeStats(cards), [cards]);

  // Complétion : combien de cartes du deck je possède déjà.
  const ownedInDeck = useMemo(
    () => cards.reduce((n, c) => n + Math.min(c.quantity, owned.get(c.cardId ?? c.id) ?? 0), 0),
    [cards, owned],
  );
  const missing = Math.max(0, stats.total - ownedInDeck);
  const completionPct = stats.total ? Math.round((ownedInDeck / stats.total) * 100) : 0;

  // Conseils de cohérence.
  const tips = useMemo(() => {
    const out: { tone: TipTone; text: string }[] = [];
    if (stats.total !== 60)
      out.push({ tone: "warn", text: `Deck ${stats.total < 60 ? "incomplet" : "trop grand"} — ${stats.total}/60 cartes.` });
    if (stats.mulliganPct != null && stats.mulliganPct >= 20)
      out.push({ tone: "danger", text: `Risque de mulligan élevé (${stats.mulliganPct}%) — ajoute des Pokémon de base.` });
    if (stats.pokemon > 0 && stats.trainerKinds.supporter < 8)
      out.push({ tone: "warn", text: `Peu de Supporters (${stats.trainerKinds.supporter}) — la consistance peut souffrir.` });
    if (stats.pokemon > 0 && stats.energy === 0)
      out.push({ tone: "warn", text: "Aucune énergie dans le deck." });
    for (const w of stats.warnings) if (!w.includes("/60")) out.push({ tone: "warn", text: w });
    if (out.length === 0) out.push({ tone: "ok", text: "Aucun souci majeur détecté. 👍" });
    return out;
  }, [stats]);

  if (decks && decks.length === 0) {
    return (
      <div className={styles.page}>
        <Header />
        <EmptyState
          icon={<Icon name="chart" size={26} />}
          title="Aucun deck à analyser"
          body="Crée un deck depuis « Mes decks » pour voir son analyse détaillée."
          action={
            <Link to="/decks" className={styles.cta}>
              <Icon name="plus" size={16} /> Mes decks
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />

      {decks && (
        <div className={styles.picker}>
          <span className={styles.pickerLabel}>Deck analysé</span>
          <Select
            className={styles.pickerSelect}
            options={decks.map((d) => ({ value: d.deck.id, label: d.deck.name }))}
            value={selected?.deck.id ?? ""}
            onChange={(e) => setDeckId(e.target.value)}
          />
        </div>
      )}

      {selected && (
        <>
          <div className={styles.summary}>
            <div className={styles.sumStat}>
              <span className={styles.sumNum}>
                <AnimatedNumber value={stats.total} />
                <span className={styles.sumMax}>/60</span>
              </span>
              <span className={styles.sumLabel}>{fr.format[selected.deck.format]}</span>
            </div>
            <div className={styles.sumStat}>
              <span className={styles.sumNum}>
                <AnimatedNumber value={completionPct} format={(n) => `${Math.round(n)}%`} />
              </span>
              <span className={styles.sumLabel}>possédé{missing > 0 ? ` · ${missing} manquantes` : ""}</span>
              <div className={styles.compBar}>
                <span className={styles.compFill} style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>

          <section className={styles.tips}>
            <span className={styles.sectionTitle}>Cohérence &amp; conseils</span>
            <ul className={styles.tipList}>
              {tips.map((t, i) => (
                <li key={i} className={[styles.tip, styles[t.tone]].join(" ")}>
                  <Icon name={t.tone === "ok" ? "spark" : "alert"} size={15} />
                  {t.text}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.statsWrap}>
            <span className={styles.sectionTitle}>Statistiques</span>
            {cards.length > 0 ? (
              <div className={styles.statsGrid}>
                <DeckStats stats={stats} />
              </div>
            ) : (
              <p className={styles.muted}>Ce deck est vide.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.kicker}>
        <Logo size={14} /> Analyse
      </span>
      <h1 className={styles.title}>Analyse de deck</h1>
      <p className={styles.subtitle}>
        Statistiques détaillées, cohérence et complétion d'un de tes decks.
      </p>
    </header>
  );
}
