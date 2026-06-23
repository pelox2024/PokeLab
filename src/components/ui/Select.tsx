import type { SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: Option[];
  placeholder?: string;
}

export function Select({ options, placeholder, className, ...rest }: SelectProps) {
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <select className={styles.select} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        ▾
      </span>
    </div>
  );
}
