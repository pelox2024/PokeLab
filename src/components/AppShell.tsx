import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { fr } from "../lib/i18n";
import { Icon } from "./ui/Icon";
import styles from "./AppShell.module.css";

const NAV = [
  { to: "/cartes", label: fr.nav.cards, icon: "cards" as const },
  { to: "/builder", label: fr.nav.builder, icon: "builder" as const },
  { to: "/decks", label: fr.nav.myDecks, icon: "decks" as const },
  { to: "/analyse", label: fr.nav.analysis, icon: "chart" as const },
  { to: "/reglages", label: fr.nav.settings, icon: "settings" as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <NavLink to="/cartes" className={styles.brand}>
            <span className={styles.logo}>
              <Icon name="spark" size={18} />
            </span>
            <span className={styles.brandText}>
              {fr.app.name}
              <span className={styles.brandTag}>{fr.app.tagline}</span>
            </span>
          </NavLink>

          <nav className={styles.links}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [styles.link, isActive ? styles.linkActive : ""].filter(Boolean).join(" ")
                }
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={styles.right}>
            <span className={styles.lang}>FR</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      {/* Bottom nav mobile */}
      <nav className={styles.bottomNav}>
        {NAV.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [styles.bottomLink, isActive ? styles.bottomActive : ""].filter(Boolean).join(" ")
            }
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
