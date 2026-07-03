import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { downloadBackup, importBackup, wipeAll } from "../db/backup";
import { getBilingualPref, getLangPref, setBilingualPref, setLangPref } from "../lib/prefs";
import type { CardLang } from "../api/types";
import { toast } from "../store/toastStore";
import { fr } from "../lib/i18n";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { Logo } from "../components/ui/Logo";
import { Icon } from "../components/ui/Icon";
import styles from "./Settings.module.css";

export function Settings() {
  const qc = useQueryClient();
  const [lang, setLang] = useState<CardLang>(getLangPref());
  const [bilingual, setBilingual] = useState<boolean>(getBilingualPref());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useLiveQuery(
    async () => ({
      decks: await db.decks.count(),
      collection: await db.collection.count(),
      saved: await db.savedSearches.count(),
    }),
    [],
    undefined,
  );

  const onLang = (l: CardLang) => {
    setLang(l);
    setLangPref(l);
    void qc.invalidateQueries(); // recharge le catalogue avec la nouvelle langue
  };

  const onBilingual = (on: boolean) => {
    setBilingual(on);
    setBilingualPref(on);
  };

  const onExport = async () => {
    try {
      await downloadBackup();
      toast("Sauvegarde exportée", "success");
    } catch {
      toast("Échec de l'export", "danger");
    }
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de réimporter le même fichier
    if (!file) return;
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const res = await importBackup(data);
      await qc.invalidateQueries();
      toast(`Import réussi : ${res.decks} deck(s), ${res.collection} carte(s)`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Fichier invalide", "danger");
    } finally {
      setBusy(false);
    }
  };

  const onWipe = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    setBusy(true);
    try {
      await wipeAll();
      await qc.invalidateQueries();
      toast("Données effacées", "success");
    } finally {
      setBusy(false);
      setConfirmWipe(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>
          <Logo size={14} /> {fr.nav.settings}
        </span>
        <h1 className={styles.title}>Réglages</h1>
        <p className={styles.subtitle}>
          Personnalise l'affichage et gère tes données locales. PokéLab fonctionne
          sur ton appareil : tes decks et ta collection restent chez toi.
        </p>
      </header>

      {/* Affichage */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <Icon name="cards" size={16} /> Affichage
          </span>
        </div>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Langue des noms de cartes</span>
              <span className={styles.rowSub}>
                Les données restent compatibles avec les decklists (nom anglais canonique).
              </span>
            </div>
            <Segmented
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" },
              ]}
              value={lang}
              onChange={(v) => onLang(v as CardLang)}
              ariaLabel="Langue des noms de cartes"
            />
          </div>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Recherche bilingue</span>
              <span className={styles.rowSub}>
                Chercher un nom en français ET en anglais simultanément.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bilingual}
              className={[styles.switch, bilingual ? styles.switchOn : ""].join(" ")}
              onClick={() => onBilingual(!bilingual)}
            >
              <span className={styles.knob} />
            </button>
          </div>
        </div>
      </section>

      {/* Données locales */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <Icon name="decks" size={16} /> Mes données
          </span>
          {counts && (
            <span className={styles.statline}>
              {counts.decks} deck{counts.decks > 1 ? "s" : ""} · {counts.collection} carte
              {counts.collection > 1 ? "s" : ""} en collection · {counts.saved} recherche
              {counts.saved > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Sauvegarde</span>
              <span className={styles.rowSub}>
                Exporte tout (decks, collection, recherches) dans un fichier, ou restaure une sauvegarde (fusion).
              </span>
            </div>
            <div className={styles.actions}>
              <Button variant="ghost" size="md" iconLeft={<Icon name="sort" size={16} />} onClick={onExport} disabled={busy}>
                Exporter
              </Button>
              <Button
                variant="ghost"
                size="md"
                iconLeft={<Icon name="plus" size={16} />}
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                Importer
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className={styles.hiddenFile}
                onChange={onImportFile}
              />
            </div>
          </div>
        </div>

        <div className={[styles.card, styles.dangerCard].join(" ")}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Effacer mes données</span>
              <span className={styles.rowSub}>
                Supprime définitivement tous les decks, la collection et les recherches de cet appareil.
                Pense à exporter d'abord.
              </span>
            </div>
            <div className={styles.actions}>
              {confirmWipe && (
                <Button variant="ghost" size="md" onClick={() => setConfirmWipe(false)} disabled={busy}>
                  Annuler
                </Button>
              )}
              <button type="button" className={styles.dangerBtn} onClick={onWipe} disabled={busy}>
                <Icon name="alert" size={16} />
                {confirmWipe ? "Confirmer l'effacement" : "Tout effacer"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* À propos */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <Icon name="spark" size={16} /> À propos
          </span>
        </div>
        <div className={styles.card}>
          <p className={styles.about}>
            {fr.app.name} — deck builder Pokémon TCG. Données des cartes : TCGdex &amp;
            pokemontcg.io. Recherche full-text propulsée par un index Supabase.
          </p>
          <p className={styles.aboutMuted}>
            Application locale : aucune donnée personnelle n'est envoyée sur un serveur.
          </p>
        </div>
      </section>
    </div>
  );
}
