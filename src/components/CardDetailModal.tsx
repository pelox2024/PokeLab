import type { ReactNode } from "react";
import type { CardRecord, FoilStyle } from "../api/types";
import { useCardDetail } from "../hooks/useCards";
import { useFoilHover } from "../hooks/useFoilHover";
import { TYPE_COLORS } from "../lib/filters";
import { fr } from "../lib/i18n";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";
import { Icon } from "./ui/Icon";
import styles from "./CardDetailModal.module.css";

interface CardDetailModalProps {
  providerId: string | null;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  Pokemon: "Pokémon",
  Trainer: "Dresseur",
  Energy: "Énergie",
  Unknown: "—",
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "var(--text-muted)";
  return (
    <span className={styles.typeBadge} style={{ ["--c" as string]: color }}>
      <span className={styles.typeDot} style={{ background: color }} />
      {type}
    </span>
  );
}

function EnergyCost({ cost }: { cost?: string[] }) {
  if (!cost?.length) return null;
  return (
    <span className={styles.cost}>
      {cost.map((c, i) => (
        <span
          key={i}
          className={styles.energy}
          style={{ background: TYPE_COLORS[c] ?? "var(--text-faint)" }}
          title={c}
        />
      ))}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value ?? fr.detail.none}</span>
    </div>
  );
}

function FoilImage({ card }: { card: CardRecord }) {
  const { ref, onPointerMove, onPointerLeave } = useFoilHover<HTMLDivElement>(true);
  const foil: FoilStyle = card.foilStyle ?? "none";
  return (
    <div className={styles.imageWrap}>
      <div
        ref={ref}
        className={styles.imageFrame}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {card.imageUrl ? (
          <img className={styles.image} src={card.imageUrl} alt={card.displayName} />
        ) : (
          <div className={styles.imageFallback}>
            <Icon name="cards" size={40} />
            <span>{card.displayName}</span>
            <span className={styles.imageFallbackMsg}>Image indisponible</span>
          </div>
        )}
        {foil !== "none" && (
          <span
            className={[
              styles.foil,
              foil === "reverse" ? styles.foilReverse : styles.foilHolo,
            ].join(" ")}
          />
        )}
        <span className={styles.glare} />
      </div>
    </div>
  );
}

function DetailContent({ card }: { card: CardRecord }) {
  const otherName = card.nameFr && card.nameEn && card.nameFr !== card.nameEn
    ? card.displayName === card.nameEn
      ? card.nameFr
      : card.nameEn
    : undefined;

  const activeVariants = [
    card.variants?.normal && fr.variant.normal,
    card.variants?.holo && fr.variant.holo,
    card.variants?.reverse && fr.variant.reverse,
    card.variants?.firstEdition && fr.variant.firstEdition,
    card.variants?.jumbo && fr.variant.jumbo,
  ].filter(Boolean) as string[];

  return (
    <div className={styles.grid}>
      <FoilImage card={card} />

      <div className={styles.details}>
        <header className={styles.detailHead}>
          <h2 id="card-detail-title" className={styles.cardName}>
            {card.displayName}
            {card.suffix && <span className={styles.suffix}>{card.suffix}</span>}
          </h2>
          {otherName && <p className={styles.otherName}>{otherName}</p>}
          <div className={styles.headMeta}>
            <span className={styles.catBadge}>{CATEGORY_LABEL[card.category]}</span>
            {card.types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
            {card.hp != null && <span className={styles.hp}>{card.hp} PV</span>}
          </div>
        </header>

        <div className={styles.statsBlock}>
          <StatRow label={fr.detail.set} value={card.setName} />
          <StatRow label={fr.detail.number} value={card.number ? `N° ${card.number}` : undefined} />
          <StatRow label={fr.detail.rarity} value={card.rarity} />
          <StatRow label={fr.detail.regulationMark} value={card.regulationMark} />
          {card.evolveFrom && <StatRow label={fr.detail.evolveFrom} value={card.evolveFrom} />}
          {card.retreatCost != null && (
            <StatRow label={fr.detail.retreat} value={String(card.retreatCost)} />
          )}
          {card.weakness?.length ? (
            <StatRow
              label={fr.detail.weakness}
              value={card.weakness.map((w) => `${w.type} ${w.value ?? ""}`.trim()).join(", ")}
            />
          ) : null}
          {card.resistance?.length ? (
            <StatRow
              label={fr.detail.resistance}
              value={card.resistance.map((w) => `${w.type} ${w.value ?? ""}`.trim()).join(", ")}
            />
          ) : null}
        </div>

        {/* Talents */}
        {card.abilities?.length ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{fr.detail.abilities}</h3>
            {card.abilities.map((a, i) => (
              <div key={i} className={styles.ability}>
                <div className={styles.abilityHead}>
                  <span className={styles.abilityTag}>{a.type ?? "Talent"}</span>
                  <span className={styles.abilityName}>{a.name}</span>
                </div>
                {a.effect && <p className={styles.effect}>{a.effect}</p>}
              </div>
            ))}
          </section>
        ) : null}

        {/* Attaques */}
        {card.attacks?.length ? (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{fr.detail.attacks}</h3>
            {card.attacks.map((a, i) => (
              <div key={i} className={styles.attack}>
                <div className={styles.attackHead}>
                  <EnergyCost cost={a.cost} />
                  <span className={styles.attackName}>{a.name}</span>
                  {a.damage && <span className={styles.damage}>{a.damage}</span>}
                </div>
                {a.effect && <p className={styles.effect}>{a.effect}</p>}
              </div>
            ))}
          </section>
        ) : null}

        {/* Légalité + variantes */}
        <div className={styles.badgesRow}>
          {card.legalities && (
            <>
              <span
                className={[styles.legal, card.legalities.standard ? styles.legalOk : styles.legalNo].join(" ")}
              >
                {fr.detail.standard}: {card.legalities.standard ? fr.detail.legal : fr.detail.illegal}
              </span>
              <span
                className={[styles.legal, card.legalities.expanded ? styles.legalOk : styles.legalNo].join(" ")}
              >
                {fr.detail.expanded}: {card.legalities.expanded ? fr.detail.legal : fr.detail.illegal}
              </span>
            </>
          )}
          {activeVariants.map((v) => (
            <span key={v} className={styles.variant}>
              {v}
            </span>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="primary" disabled iconLeft={<Icon name="plus" size={18} />}>
            {fr.cards.addToDeck}
          </Button>
          {card.illustrator && (
            <span className={styles.illustrator}>
              {fr.detail.illustrator} · {card.illustrator}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.grid}>
      <div className={styles.imageWrap}>
        <Skeleton height="100%" radius="var(--radius-lg)" className={styles.skelImage} />
      </div>
      <div className={styles.details}>
        <Skeleton width="60%" height="28px" />
        <Skeleton width="40%" height="16px" />
        <div style={{ height: 12 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="100%" height="16px" />
        ))}
      </div>
    </div>
  );
}

export function CardDetailModal({ providerId, onClose }: CardDetailModalProps) {
  const { data, isLoading, isError } = useCardDetail(providerId);

  return (
    <Modal open={!!providerId} onClose={onClose} labelledBy="card-detail-title" size="lg">
      <div className={styles.scroll}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError || !data ? (
          <EmptyState
            tone="danger"
            icon={<Icon name="alert" size={26} />}
            title={fr.states.errorTitle}
            body={fr.detail.loadError}
          />
        ) : (
          <DetailContent card={data} />
        )}
      </div>
    </Modal>
  );
}
