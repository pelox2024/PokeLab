import type { ReactNode } from "react";
import type { DeckStats as Stats } from "../lib/deckStats";
import { typeLabel } from "../lib/filters";
import { TypeIcon } from "./ui/TypeIcon";
import styles from "./DeckStats.module.css";

interface Seg {
  label: string;
  value: number;
  color: string;
}

/** Anneau de composition (SVG, segments proportionnels). */
function Donut({ segments, center, sub }: { segments: Seg[]; center: string; sub?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 15.915; // circonférence ≈ 100
  // Pré-calcul des arcs (longueur + décalage cumulé) sans mutation au rendu.
  const visible = segments.filter((s) => s.value > 0);
  const lens = visible.map((s) => (s.value / total) * 100);
  const arcs = visible.map((s, i) => ({
    color: s.color,
    len: lens[i],
    offset: lens.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  return (
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 36 36" className={styles.donut} role="img" aria-label="Composition">
        <circle className={styles.donutTrack} cx="18" cy="18" r={R} />
        {arcs.map((a) => (
          <circle
            key={a.color}
            cx="18"
            cy="18"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="3.6"
            strokeDasharray={`${a.len} ${100 - a.len}`}
            strokeDashoffset={-a.offset}
            transform="rotate(-90 18 18)"
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className={styles.donutCenter}>
        <span className={styles.donutNum}>{center}</span>
        {sub && <span className={styles.donutSub}>{sub}</span>}
      </div>
    </div>
  );
}

function Card({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <span>{title}</span>
        {hint && <span className={styles.cardHint}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Barre segmentée colorée. */
function SegBar({ segments }: { segments: Seg[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={styles.segbar}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span
            key={s.label}
            className={styles.segbarPart}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label} · ${s.value}`}
          />
        ))}
    </div>
  );
}

function Legend({ segments }: { segments: Seg[] }) {
  return (
    <div className={styles.legend}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span key={s.label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            {s.label}
            <b>{s.value}</b>
          </span>
        ))}
    </div>
  );
}

function Tally({ items }: { items: { label: string; value: number }[] }) {
  const shown = items.filter((i) => i.value > 0);
  if (shown.length === 0) return <span className={styles.muted}>—</span>;
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

function Histogram({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className={styles.histo}>
      {buckets.map((b) => (
        <div key={b.label} className={styles.histoCol}>
          <span className={styles.histoVal}>{b.count > 0 ? b.count : ""}</span>
          <span className={styles.histoBarWrap}>
            <span className={styles.histoBar} style={{ height: `${(b.count / max) * 100}%` }} data-empty={b.count === 0 ? "" : undefined} />
          </span>
          <span className={styles.histoLabel}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// Seuils de risque de mulligan (heuristique communauté : viser < ~15 %).
function mulliganTone(pct: number): { color: string; word: string } {
  if (pct < 12) return { color: "var(--success)", word: "faible" };
  if (pct < 20) return { color: "var(--warning)", word: "modéré" };
  return { color: "var(--danger)", word: "élevé" };
}

const C = {
  pokemon: "var(--accent)",
  trainer: "var(--type-fighting)",
  energy: "var(--type-lightning)",
  other: "var(--text-faint)",
};

export function DeckStats({ stats }: { stats: Stats }) {
  const hasHp = stats.hpBuckets.some((b) => b.count > 0);
  const hasMechanics = stats.mechanics.ex + stats.mechanics.v + stats.mechanics.vmax + stats.mechanics.vstar > 0;
  const mt = stats.mulliganPct != null ? mulliganTone(stats.mulliganPct) : null;

  const compSegments: Seg[] = [
    { label: "Pokémon", value: stats.pokemon, color: C.pokemon },
    { label: "Dresseurs", value: stats.trainer, color: C.trainer },
    { label: "Énergies", value: stats.energy, color: C.energy },
    { label: "Autres", value: stats.other, color: C.other },
  ];

  return (
    <div className={styles.wrap}>
      <Card title="Composition">
        <div className={styles.compRow}>
          <Donut segments={compSegments} center={String(stats.total)} sub="cartes" />
          <Legend segments={compSegments} />
        </div>
      </Card>

      {mt && (
        <Card title="Risque de mulligan" hint={`${stats.basicCount} Pokémon de base`}>
          <div className={styles.metricRow}>
            <span className={styles.metricBig} style={{ color: mt.color }}>
              {stats.mulliganPct}
              <span className={styles.metricUnit}>%</span>
            </span>
            <span className={styles.metricWord} style={{ color: mt.color }}>
              {mt.word}
            </span>
          </div>
          <div className={styles.gauge}>
            <span
              className={styles.gaugeFill}
              style={{ width: `${Math.min(100, (stats.mulliganPct ?? 0) * 2.5)}%`, background: mt.color }}
            />
          </div>
          <span className={styles.note}>Probabilité de n'avoir aucun Pokémon de base en main de départ.</span>
        </Card>
      )}

      {stats.pokemon > 0 && (
        <Card title="Récompenses cédées" hint={`moy. ${stats.prizeAvg}/Pokémon`}>
          <SegBar
            segments={[
              { label: "1 prize", value: stats.prizeBreakdown.one, color: "var(--success)" },
              { label: "2 prizes", value: stats.prizeBreakdown.two, color: "var(--warning)" },
              { label: "3 prizes", value: stats.prizeBreakdown.three, color: "var(--danger)" },
            ]}
          />
          <Tally
            items={[
              { label: "1 prize", value: stats.prizeBreakdown.one },
              { label: "2 prizes", value: stats.prizeBreakdown.two },
              { label: "3 prizes", value: stats.prizeBreakdown.three },
            ]}
          />
        </Card>
      )}

      {hasHp && (
        <Card title="Courbe de PV" hint={stats.avgHp ? `moy. ${stats.avgHp}` : undefined}>
          <Histogram buckets={stats.hpBuckets} />
        </Card>
      )}

      {stats.typeCounts.length > 0 && (
        <Card title="Types">
          <div className={styles.types}>
            {stats.typeCounts.map(({ type, count }) => (
              <span key={type} className={styles.typeChip} title={typeLabel(type)}>
                <TypeIcon type={type} size="sm" withBg={false} />
                {count}
              </span>
            ))}
          </div>
        </Card>
      )}

      {stats.pokemon > 0 && (
        <Card title="Pokémon par niveau">
          <Tally
            items={[
              { label: "De base", value: stats.stages.basic },
              { label: "Niv. 1", value: stats.stages.stage1 },
              { label: "Niv. 2", value: stats.stages.stage2 },
              { label: "VMAX/VSTAR", value: stats.stages.vEvo },
            ]}
          />
        </Card>
      )}

      {hasMechanics && (
        <Card title="Mécaniques">
          <Tally
            items={[
              { label: "ex", value: stats.mechanics.ex },
              { label: "V", value: stats.mechanics.v },
              { label: "VMAX", value: stats.mechanics.vmax },
              { label: "VSTAR", value: stats.mechanics.vstar },
            ]}
          />
        </Card>
      )}

      {stats.trainer > 0 && (
        <Card title="Dresseurs">
          <Tally
            items={[
              { label: "Objet", value: stats.trainerKinds.item },
              { label: "Supporter", value: stats.trainerKinds.supporter },
              { label: "Stade", value: stats.trainerKinds.stadium },
              { label: "Outil", value: stats.trainerKinds.tool },
            ]}
          />
        </Card>
      )}

      {stats.energy > 0 && (
        <Card title="Énergies">
          <Tally
            items={[
              { label: "De base", value: stats.energySplit.basic },
              { label: "Spéciale", value: stats.energySplit.special },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
