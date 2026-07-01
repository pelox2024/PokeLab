import { createPortal } from "react-dom";
import { useToastStore } from "../../store/toastStore";
import { Icon } from "./Icon";
import styles from "./Toaster.module.css";

const ICON = { default: "spark", success: "spark", danger: "alert" } as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return createPortal(
    <div className={styles.wrap} role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={[styles.toast, styles[t.tone]].join(" ")}
          onClick={() => dismiss(t.id)}
        >
          <Icon name={ICON[t.tone]} size={16} />
          <span className={styles.msg}>{t.message}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
