import { useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { fr } from "../lib/i18n";
import { Icon } from "./ui/Icon";
import { Logo } from "./ui/Logo";
import { Toaster } from "./ui/Toaster";
import styles from "./AppShell.module.css";

const NAV = [
  { to: "/cartes", label: fr.nav.cards, icon: "cards" as const },
  { to: "/builder", label: fr.nav.builder, icon: "builder" as const },
  { to: "/decks", label: fr.nav.myDecks, icon: "decks" as const },
  { to: "/collection", label: "Collection", icon: "spark" as const },
  { to: "/analyse", label: fr.nav.analysis, icon: "chart" as const },
  { to: "/reglages", label: fr.nav.settings, icon: "settings" as const },
];

const NAV_HOME = { to: "/", label: "Accueil", icon: "spark" as const };

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <NavLink to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
            <span className={styles.logo}>
              <Logo size={20} />
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
            <button
              type="button"
              className={styles.burger}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <Icon name={menuOpen ? "close" : "menu"} size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer de navigation (mobile) */}
      {menuOpen && (
        <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)}>
          <nav className={styles.menuDrawer} onClick={(e) => e.stopPropagation()}>
            {[NAV_HOME, ...NAV].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  [styles.menuLink, isActive ? styles.menuLinkActive : ""].filter(Boolean).join(" ")
                }
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <main className={styles.main}>
        <div key={pathname} className={styles.pageTransition}>
          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}
