import type { DeckStats as Stats } from "../lib/deckStats";
import { typeLabel } from "../lib/filters";
import { TypeIcon } from "./ui/TypeIcon";
import styles from "./DeckStats.module.css";

interface SegBar {
  label: string;
  value: number;
  color: string;
}

/** Barre empilée (répartition catégories). */
function StackBar({ segments }: { segments: SegBar[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={styles.stack}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span
            key={s.label}
            className={styles.stackSeg}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label} · ${s.value}`}
          />
        ))}
    </div>
  );
}

/** Histogramme vertical (courbe de PV). */
function Histogram({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className={styles.histo}>
      {buckets.map((b) => (
        <div key={b.label} className={styles.histoCol}>
          <span className={styles.histoVal}>{b.count > 0 ? b.count : ""}</span>
          <span className={styles.histoBarWrap}>
            <span
              className={styles.histoBar}
              style={{ height: `${(b.count / max) * 100}%` }}
              data-empty={b.count === 0 ? "" : undefined}
            />
          </span>
          <span className={styles.histoLabel}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function Tally({ items }: { items: { label: string; value: number }[] }) {
  const shown = items.filter((i) => i.value > 0);
  if (shown.length === 0) return null;
  return (
    <div className={styles.tally}>
      {shown.map((i) => (
        <span key={i.label} className={styles.tallyItem}>
          {i.label} <b>{i.value}</b>
        </span>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <span className={styles.sectionTitle}>{title}</span>
      {children}
    </section>
  );
}

export function DeckStats({ stats }: { stats: Stats }) {
  const hasPokemon = stats.pokemon > 0;
  const hasHp = stats.hpBuckets.some((b) => b.count > 0);
  const hasMechanics =
    stats.mechanics.ex + stats.mechanics.v + stats.mechanics.vmax + stats.mechanics.vstar > 0;

  return (
    <div className={styles.wrap}>
      <Section title="Répartition">
        <StackBar
          segments={[
            { label: "Pokémon", value: stats.pokemon, color: "var(--accent)" },
            { label: "Dresseurs", value: stats.trainer, color: "var(--type-fighting)" },
            { label: "Énergies", value: stats.energy, color: "var(--type-lightning)" },
            { label: "Autres", value: stats.other, color: "var(--text-faint)" },
          ]}
        />
        <Tally
          items={[
            { label: "Pokémon", value: stats.pokemon },
            { label: "Dresseurs", value: stats.trainer },
            { label: "Énergies", value: stats.energy },
            { label: "Autres", value: stats.other },
          ]}
        />
      </Section>

      {hasHp && (
        <Section title={`Courbe de PV${stats.avgHp ? ` · moy. ${stats.avgHp}` : ""}`}>
          <Histogram buckets={stats.hpBuckets} />
        </Section>
      )}

      {hasPokemon && stats.typeCounts.length > 0 && (
        <Section title="Types">
          <div className={styles.types}>
            {stats.typeCounts.map(({ type, count }) => (
              <span key={type} className={styles.typeChip} title={typeLabel(type)}>
                <TypeIcon type={type} size="sm" withBg={false} />
                {count}
              </span>
            ))}
          </div>
        </Section>
      )}

      {hasMechanics && (
        <Section title="Mécaniques">
          <Tally
            items={[
              { label: "ex", value: stats.mechanics.ex },
              { label: "V", value: stats.mechanics.v },
              { label: "VMAX", value: stats.mechanics.vmax },
              { label: "VSTAR", value: stats.mechanics.vstar },
            ]}
          />
        </Section>
      )}

      {hasPokemon && (
        <Section title="Pokémon par niveau">
          <Tally
            items={[
              { label: "De base", value: stats.stages.basic },
              { label: "Niveau 1", value: stats.stages.stage1 },
              { label: "Niveau 2", value: stats.stages.stage2 },
              { label: "VMAX/VSTAR", value: stats.stages.vEvo },
            ]}
          />
        </Section>
      )}

      {stats.trainer > 0 && (
        <Section title="Dresseurs">
          <Tally
            items={[
              { label: "Objet", value: stats.trainerKinds.item },
              { label: "Supporter", value: stats.trainerKinds.supporter },
              { label: "Stade", value: stats.trainerKinds.stadium },
              { label: "Outil", value: stats.trainerKinds.tool },
            ]}
          />
        </Section>
      )}

      {stats.energy > 0 && (
        <Section title="Énergies">
          <Tally
            items={[
              { label: "De base", value: stats.energySplit.basic },
              { label: "Spéciale", value: stats.energySplit.special },
            ]}
          />
        </Section>
      )}
    </div>
  );
}
