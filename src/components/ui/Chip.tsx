import type { ReactNode } from "react";
import styles from "./Chip.module.css";

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  /** Couleur d'accent optionnelle (ex: type d'énergie). */
  accent?: string;
}

export function Chip({ active, onClick, children, title, accent }: ChipProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[styles.chip, active ? styles.active : ""].filter(Boolean).join(" ")}
      style={accent && active ? { ["--chip-accent" as string]: accent } : undefined}
    >
      {children}
    </button>
  );
}
