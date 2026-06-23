import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Input.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: ReactNode;
  trailing?: ReactNode;
  sizeVariant?: "md" | "lg";
}

export function Input({ iconLeft, trailing, sizeVariant = "md", className, ...rest }: InputProps) {
  return (
    <div
      className={[styles.wrap, styles[sizeVariant], className].filter(Boolean).join(" ")}
    >
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      <input className={styles.input} {...rest} />
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
