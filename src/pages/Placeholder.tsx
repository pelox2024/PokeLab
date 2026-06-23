import type { ReactNode } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { fr } from "../lib/i18n";
import styles from "./Cards.module.css";

interface PlaceholderPageProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  body: string;
}

function PlaceholderPage({ icon, title, subtitle, body }: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>{icon}</span>
          <div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>
      </header>
      <EmptyState
        icon={<Icon name="spark" size={26} />}
        title={fr.states.comingSoonTitle}
        body={body}
      />
    </div>
  );
}

export function Builder() {
  return (
    <PlaceholderPage
      icon={<Icon name="builder" size={22} />}
      title={fr.nav.builder}
      subtitle="Construisez vos decks de 60 cartes"
      body={fr.builder.comingSoon}
    />
  );
}

export function MyDecks() {
  return (
    <PlaceholderPage
      icon={<Icon name="decks" size={22} />}
      title={fr.nav.myDecks}
      subtitle="Tous vos decks sauvegardés"
      body={fr.myDecks.comingSoon}
    />
  );
}

export function Analysis() {
  return (
    <PlaceholderPage
      icon={<Icon name="chart" size={22} />}
      title={fr.nav.analysis}
      subtitle="Statistiques et alertes de deck"
      body={fr.analysis.comingSoon}
    />
  );
}

export function Settings() {
  return (
    <PlaceholderPage
      icon={<Icon name="settings" size={22} />}
      title={fr.nav.settings}
      subtitle="Préférences de l'application"
      body={fr.settings.comingSoon}
    />
  );
}
