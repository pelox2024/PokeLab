import type { ReactNode } from "react";
import { Icon } from "../components/ui/Icon";
import { Logo } from "../components/ui/Logo";
import { fr } from "../lib/i18n";
import styles from "./Placeholder.module.css";

interface Feature {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  sub: string;
}

interface ComingSoonProps {
  kicker: string;
  title: string;
  subtitle: string;
  panelTitle: string;
  features: Feature[];
}

function ComingSoon({ kicker, title, subtitle, panelTitle, features }: ComingSoonProps): ReactNode {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>
          <Logo size={14} /> {kicker}
        </span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelTop}>
          <span className={styles.mark}>
            <Logo size={26} />
          </span>
          <div>
            <span className={styles.badge}>{fr.states.comingSoonTitle}</span>
            <div className={styles.panelTitle}>{panelTitle}</div>
          </div>
        </div>

        <ul className={styles.features}>
          {features.map((f) => (
            <li key={f.title} className={styles.feature}>
              <span className={styles.featureIcon}>
                <Icon name={f.icon} size={16} />
              </span>
              <span className={styles.featureText}>
                <span className={styles.featureTitle}>{f.title}</span>
                <span className={styles.featureSub}>{f.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Settings() {
  return (
    <ComingSoon
      kicker={fr.nav.settings}
      title="Réglages"
      subtitle="Personnalise l'affichage et gère tes données. La synchronisation multi-appareils arrivera avec les comptes."
      panelTitle="Bientôt configurable"
      features={[
        { icon: "cards", title: "Langue des cartes", sub: "Affichage FR / EN (les données restent compatibles decklists)." },
        { icon: "sort", title: "Densité & thème", sub: "Préférences d'affichage par défaut de la grille et du deck." },
        { icon: "decks", title: "Données locales", sub: "Exporter / importer / effacer tes decks et ta collection." },
        { icon: "spark", title: "Compte & sync", sub: "Connexion et synchronisation cloud (à venir)." },
      ]}
    />
  );
}
