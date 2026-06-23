import type { ReactElement } from "react";
import styles from "./TypeIcon.module.css";

export type PokemonType =
  | "Grass"
  | "Fire"
  | "Water"
  | "Lightning"
  | "Psychic"
  | "Fighting"
  | "Darkness"
  | "Metal"
  | "Dragon"
  | "Colorless"
  | "Fairy";

const COLORS: Record<PokemonType, string> = {
  Grass: "var(--type-grass)",
  Fire: "var(--type-fire)",
  Water: "var(--type-water)",
  Lightning: "var(--type-lightning)",
  Psychic: "var(--type-psychic)",
  Fighting: "var(--type-fighting)",
  Darkness: "var(--type-darkness)",
  Metal: "var(--type-metal)",
  Dragon: "var(--type-dragon)",
  Colorless: "var(--type-colorless)",
  Fairy: "var(--type-fairy)",
};

const LABELS: Record<PokemonType, string> = {
  Grass: "Plante",
  Fire: "Feu",
  Water: "Eau",
  Lightning: "Électrique",
  Psychic: "Psy",
  Fighting: "Combat",
  Darkness: "Obscurité",
  Metal: "Métal",
  Dragon: "Dragon",
  Colorless: "Incolore",
  Fairy: "Fée",
};

// SVG maison, stylisés, cohérents avec le design system (24x24, fill).
const GLYPHS: Record<PokemonType, ReactElement> = {
  Grass: <path d="M12 21c0-7 3-12 8-15-1 7-3 11-8 12 0-4 1-7 3-9-3 2-5 6-5 12 0 0-1-3-4-4 2 0 1 2 6 4Z" />,
  Fire: <path d="M12 2c1 4 5 5 5 10a5 5 0 1 1-10 0c0-2 1-3 2-4 0 1 1 2 2 2 0-3-1-5 1-8Z" />,
  Water: <path d="M12 3c3 5 6 8 6 12a6 6 0 1 1-12 0c0-4 3-7 6-12Z" />,
  Lightning: <path d="M13 2 5 13h5l-2 9 9-12h-5l3-8Z" />,
  Psychic: <path d="M12 3c5 0 8 4 8 9 0 3-2 5-4 5s-3-2-3-4 1-3 0-4-2 0-2 2 1 6-3 6c-3 0-5-3-5-7 0-4 3-7 9-7Z" />,
  Fighting: <path d="M7 4h6l1 4 3 1v6a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4V8l2-1V4Z" />,
  Darkness: <path d="M16 3a8 8 0 1 0 5 13A7 7 0 0 1 16 3Z" />,
  Metal: <path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-4Zm0 4 4 2v4c0 3-2 4-4 5-2-1-4-2-4-5V8l4-2Z" />,
  Dragon: <path d="M12 2 21 7l-3 4 3 4-9 5-9-5 3-4-3-4 9-5Zm0 4L7 8l2 3-2 3 5 3 5-3-2-3 2-3-5-2Z" />,
  Colorless: <path d="m12 3 2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3Z" />,
  Fairy: <path d="M12 2c1 3 2 5 5 5-3 1-4 3-5 8-1-5-2-7-5-8 3 0 4-2 5-5Zm6 11c.6 1.5 1.2 2.4 3 3-1.8.6-2.4 1.5-3 4-.6-2.5-1.2-3.4-3-4 1.8-.6 2.4-1.5 3-3Z" />,
};

interface TypeIconProps {
  type: string;
  size?: "sm" | "md";
  withBg?: boolean;
}

export function TypeIcon({ type, size = "sm", withBg = true }: TypeIconProps) {
  const key = (type in COLORS ? type : "Colorless") as PokemonType;
  const color = COLORS[key];
  const px = size === "sm" ? 16 : 22;
  const box = size === "sm" ? 22 : 30;

  return (
    <span
      className={[styles.wrap, withBg ? styles.bg : ""].filter(Boolean).join(" ")}
      style={{ ["--tc" as string]: color, width: withBg ? box : px, height: withBg ? box : px }}
      role="img"
      aria-label={LABELS[key]}
      title={LABELS[key]}
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill={color} aria-hidden="true">
        {GLYPHS[key]}
      </svg>
    </span>
  );
}
