import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { Deck, DeckVersion } from "../db/schema";
import { deckTotal, useDeckStore } from "../store/deckStore";
import { useSets } from "../hooks/useCards";
import { orderSetsByRecency } from "../lib/cardSort";
import { fr } from "../lib/i18n";
import { Icon } from "../components/ui/Icon";
import styles from "./Home.module.css";

interface DeckSummary {
  deck: Deck;
  version?: DeckVersion;
  total: number;
}

export function Home() {
  const navigate = useNavigate();
  const load = useDeckStore((s) => s.load);
  const { data: sets } = useSets();

  const summaries = useLiveQuery<DeckSummary[]>(async () => {
    const decks = await db.decks.orderBy("updatedAt").reverse().toArray();
    const versions = await db.versions.toArray();
    const firstByDeck = new Map<string, DeckVersion>();
    for (const v of versions) if (!firstByDeck.has(v.deckId)) firstByDeck.set(v.deckId, v);
    return decks
      .filter((d) => !d.archived)
      .map((deck) => {
        const version = firstByDeck.get(deck.id);
        return { deck, version, total: version ? deckTotal(version.cards) : 0 };
      });
  }, []);

  const recent = (summaries ?? []).slice(0, 4);
  const deckCount = (summaries ?? []).length;

  const latestSet = useMemo(() => {
    if (!sets?.length) return undefined;
    return orderSetsByRecency(sets.filter((s) => s.seriesId !== "tcgp"), true)[0];
  }, [sets]);

  const openDeck = (s: DeckSummary) => {
    if (!s.version) return;
    load({ deckId: s.deck.id, versionId: s.version.id, name: s.deck.name, format: s.deck.format, cards: s.version.cards });
    navigate("/builder");
  };

  return (
    <div className={styles.page}>
      <section className={styles.bento}>
        {/* Hero */}
        <div className={[styles.tile, styles.hero].join(" ")}>
          <div className={styles.heroGlow} />
          <div className={styles.heroInner}>
            <span className={styles.kicker}>Deck Builder Pokémon TCG</span>
            <h1 className={styles.heroTitle}>
              Construis, analyse et
              <br />
              optimise tes decks.
            </h1>
            <p className={styles.heroSub}>
              Explorateur de cartes complet, statistiques de jeu (mulligan, prizes, courbe de PV) et import/export PTCG Live.
            </p>
            <div className={styles.heroCtas}>
              <Link to="/cartes" className={styles.ctaPrimary}>
                <Icon name="cards" size={18} />
                Explorer les cartes
              </Link>
              <Link to="/builder" className={styles.ctaGhost}>
                <Icon name="builder" size={18} />
                Constructeur
              </Link>
            </div>
          </div>
        </div>

        {/* Decks récents */}
        <div className={[styles.tile, styles.decks].join(" ")}>
          <div className={styles.tileHead}>
            <span className={styles.tileTitle}>
              <Icon name="decks" size={16} /> Decks récents
            </span>
            <Link to="/decks" className={styles.tileLink}>
              Tout voir
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className={styles.empty}>
              <p>Aucun deck pour l'instant.</p>
              <Link to="/decks" className={styles.ctaGhost}>
                <Icon name="plus" size={16} /> Créer un deck
              </Link>
            </div>
          ) : (
            <div className={styles.deckList}>
              {recent.map((s) => {
                const complete = s.total === 60;
                return (
                  <button key={s.deck.id} type="button" className={styles.deckRow} onClick={() => openDeck(s)}>
                    <span className={styles.deckName}>{s.deck.name}</span>
                    <span className={[styles.deckCount, complete ? styles.deckOk : ""].join(" ")}>{s.total}/60</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cartes */}
        <Link to="/cartes" className={[styles.tile, styles.action, styles.accentBlue].join(" ")}>
          <Icon name="cards" size={24} />
          <span className={styles.actionTitle}>Catalogue de cartes</span>
          <span className={styles.actionSub}>Recherche FR/EN, filtres, tri par set</span>
          <span className={styles.arrow}>→</span>
        </Link>

        {/* Mes decks (stat) */}
        <Link to="/decks" className={[styles.tile, styles.stat, styles.accentViolet].join(" ")}>
          <span className={styles.statNum}>{deckCount}</span>
          <span className={styles.statLabel}>deck{deckCount > 1 ? "s" : ""} enregistré{deckCount > 1 ? "s" : ""}</span>
          <span className={styles.arrow}>→</span>
        </Link>

        {/* Extension récente */}
        <Link to="/cartes" className={[styles.tile, styles.newset, styles.accentTeal].join(" ")}>
          <span className={styles.tileTitle}>
            <Icon name="spark" size={16} /> Dernière extension
          </span>
          {latestSet ? (
            <div className={styles.setRow}>
              {latestSet.logoUrl && <img src={latestSet.logoUrl} alt="" className={styles.setLogo} loading="lazy" />}
              <div>
                <span className={styles.setName}>{latestSet.name}</span>
                <span className={styles.setMeta}>
                  {latestSet.releaseDate?.slice(0, 4)}
                  {latestSet.cardCount ? ` · ${latestSet.cardCount} cartes` : ""}
                </span>
              </div>
            </div>
          ) : (
            <span className={styles.actionSub}>Chargement…</span>
          )}
        </Link>
      </section>

      <p className={styles.footer}>{fr.app.name} · données TCGdex & pokemontcg.io</p>
    </div>
  );
}
