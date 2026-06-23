import { useState } from "react";
import type { ReactNode } from "react";
import type { CardPricing, CardRecord } from "../api/types";
import { useCardDetail, usePokemontcgPrice } from "../hooks/useCards";
import { useFoilHover } from "../hooks/useFoilHover";
import { getCardVisualTreatment } from "../lib/foil";
import { cardmarketLink, canShowPrice, hasExactLink, pickCardmarket } from "../lib/pricing";
import { TYPE_COLORS } from "../lib/filters";
import { fr } from "../lib/i18n";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";
import { Icon } from "./ui/Icon";
import { FoilOverlay } from "./ui/FoilOverlay";
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
  const treatment = getCardVisualTreatment(card);
  const special = treatment.foilZone !== "none";
  const { ref, onPointerMove, onPointerLeave } = useFoilHover<HTMLDivElement>({
    tilt: true,
    glare: special,
  });
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
            <span className={styles.fbName}>{card.displayName}</span>
            {card.number && <span className={styles.fbNum}>N° {card.number}</span>}
            <span className={styles.imageFallbackMsg}>Image indisponible</span>
          </div>
        )}
        {special && card.imageUrl && (
          <>
            <FoilOverlay treatment={treatment} />
            <span className={styles.glare} />
          </>
        )}
      </div>
    </div>
  );
}

/** Bouton qui copie une valeur dans le presse-papiers avec feedback. */
function CopyButton({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible — on ignore silencieusement */
    }
  };
  return (
    <Button variant="ghost" size="sm" iconLeft={copied ? <Icon name="spark" size={15} /> : icon} onClick={copy}>
      {copied ? fr.detail.copied : label}
    </Button>
  );
}

function PriceBlock({ card, cm }: { card: CardRecord; cm?: CardPricing }) {
  const exact = hasExactLink(cm);
  const link = cardmarketLink(card, cm);
  const fmt = (n?: number) => (n != null ? `${n.toFixed(2)} ${cm?.currency ?? "EUR"}` : fr.detail.none);

  const LinkButton = (
    <a className={styles.cmLink} href={link} target="_blank" rel="noopener noreferrer">
      {exact ? fr.detail.viewCardmarket : fr.detail.searchCardmarket}
      <Icon name="search" size={14} />
    </a>
  );

  const showValues = canShowPrice(cm);
  const date = cm?.updatedAt ? new Date(cm.updatedAt).toLocaleDateString("fr-FR") : undefined;
  const hasHolo = cm != null && (cm.holoAvg != null || cm.holoLow != null || cm.holoTrend != null);

  // Titre + tag selon la confiance
  const indicative = cm?.confidence === "indicative";
  const title = indicative ? fr.detail.priceIndicative : fr.detail.price;

  let tag: string | null = null;
  if (cm?.confidence === "exact" || cm?.confidence === "variant") tag = "Cardmarket";
  else if (indicative) tag = "Cardmarket · indicatif";

  return (
    <section className={styles.priceBlock}>
      <div className={styles.priceHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {tag && <span className={styles.cmTag}>{tag}</span>}
        {!tag && (
          <span className={styles.priceUnavailable}>
            {cm?.confidence === "unsafe" ? fr.detail.priceToVerify : fr.detail.priceUnavailable}
          </span>
        )}
      </div>

      {/* Message de prudence quand on ne montre pas de chiffres */}
      {cm?.confidence === "unsafe" && <p className={styles.priceWarn}>{fr.detail.priceUnsafe}</p>}
      {!cm && <p className={styles.priceMuted}>{fr.detail.priceNoData}</p>}

      {/* Valeurs seulement si exploitables */}
      {showValues && (
        <>
          <div className={styles.priceGrid}>
            <div className={styles.priceCell}>
              <span className={styles.priceLabel}>{fr.detail.priceLow}</span>
              <span className={styles.priceValue}>{fmt(cm!.low)}</span>
            </div>
            <div className={styles.priceCell}>
              <span className={styles.priceLabel}>{fr.detail.priceTrend}</span>
              <span className={[styles.priceValue, styles.priceTrend].join(" ")}>{fmt(cm!.trend)}</span>
            </div>
            <div className={styles.priceCell}>
              <span className={styles.priceLabel}>{fr.detail.priceAvg}</span>
              <span className={styles.priceValue}>{fmt(cm!.avg)}</span>
            </div>
          </div>

          {hasHolo && (
            <>
              <span className={styles.priceSub}>{fr.detail.priceHolo}</span>
              <div className={styles.priceGrid}>
                <div className={styles.priceCell}>
                  <span className={styles.priceLabel}>{fr.detail.priceLow}</span>
                  <span className={styles.priceValue}>{fmt(cm!.holoLow)}</span>
                </div>
                <div className={styles.priceCell}>
                  <span className={styles.priceLabel}>{fr.detail.priceTrend}</span>
                  <span className={[styles.priceValue, styles.priceTrend].join(" ")}>
                    {fmt(cm!.holoTrend)}
                  </span>
                </div>
                <div className={styles.priceCell}>
                  <span className={styles.priceLabel}>{fr.detail.priceAvg}</span>
                  <span className={styles.priceValue}>{fmt(cm!.holoAvg)}</span>
                </div>
              </div>
            </>
          )}

          {indicative && <p className={styles.priceMuted}>{fr.detail.priceIndicativeNote}</p>}
        </>
      )}

      <div className={styles.priceFooter}>
        {LinkButton}
        {showValues && date && <span className={styles.priceDate}>{fr.detail.priceUpdated(date)}</span>}
      </div>
    </section>
  );
}

function DetailContent({ card }: { card: CardRecord }) {
  // Prix exact via pokemontcg.io (prioritaire), repli TCGdex indicatif.
  const { data: livePrice } = usePokemontcgPrice(card);
  const resolvedPrice = livePrice ?? pickCardmarket(card.pricing);

  const otherName =
    card.nameFr && card.nameEn && card.nameFr !== card.nameEn
      ? card.displayName === card.nameEn
        ? card.nameFr
        : card.nameEn
      : undefined;

  const idValue = card.setId && card.number ? `${card.setId.toUpperCase()} ${card.number}` : card.providerId;

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

        {/* Actions rapides */}
        <div className={styles.quickActions}>
          <CopyButton label={fr.detail.copyName} value={card.name} icon={<Icon name="cards" size={15} />} />
          <CopyButton label={fr.detail.copyId} value={idValue} icon={<Icon name="decks" size={15} />} />
          {card.imageUrl && (
            <a
              className={styles.openImg}
              href={card.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="search" size={15} />
              {fr.detail.openImage}
            </a>
          )}
        </div>

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

        {/* Prix */}
        <PriceBlock card={card} cm={resolvedPrice} />

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

        <div className={styles.footerRow}>
          {card.illustrator && (
            <span className={styles.illustrator}>
              {fr.detail.illustrator} · {card.illustrator}
            </span>
          )}
          <span className={styles.soonNote}>{fr.detail.addToDeckSoon}</span>
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
