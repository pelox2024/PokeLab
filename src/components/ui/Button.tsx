import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[styles.btn, styles[variant], styles[size], className].filter(Boolean).join(" ")}
      {...rest}
    >
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      {children}
    </button>
  );
}
