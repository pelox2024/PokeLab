import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}

export function EmptyState({ icon, title, body, action, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className={[styles.wrap, tone === "danger" ? styles.danger : ""].filter(Boolean).join(" ")}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      {body && <p className={styles.body}>{body}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
