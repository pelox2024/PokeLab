import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { CardBrief, CardPricing, CardRecord } from "../api/types";
import { useCardDetail, useCardVersions, usePokemontcgPrice } from "../hooks/useCards";
import { useFoilHover } from "../hooks/useFoilHover";
import { getCardVisualTreatment } from "../lib/foil";
import { cardmarketLink, canShowPrice, hasExactLink, pickCardmarket } from "../lib/pricing";
import { useDeckStore } from "../store/deckStore";
import { adjustOwned, useOwnedMap } from "../db/collection";
import { TYPE_COLORS } from "../lib/filters";
import { fr } from "../lib/i18n";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import { EmptyState } from "./ui/EmptyState";
import { Icon } from "./ui/Icon";
import { FoilOverlay } from "./ui/FoilOverlay";
import { TypeIcon } from "./ui/TypeIcon";
import styles from "./CardDetailModal.module.css";

interface CardDetailModalProps {
  providerId: string | null;
  onClose: () => void;
  onSelectCard?: (providerId: string) => void;
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
      <TypeIcon type={type} size="sm" withBg={false} />
      {type}
    </span>
  );
}

function EnergyCost({ cost }: { cost?: string[] }) {
  if (!cost?.length) return null;
  return (
    <span className={styles.cost}>
      {cost.map((c, i) => (
        <TypeIcon key={i} type={c} size="sm" />
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

function PriceCells({ cells, currency }: { cells: [string, number | undefined][]; currency: string }) {
  // 0 ou négatif = donnée absente (ex: reverseHolo=0 pour une carte sans reverse).
  const present = cells.filter(([, v]) => v != null && v > 0) as [string, number][];
  if (!present.length) return null;
  return (
    <div className={styles.priceGrid}>
      {present.map(([label, v]) => (
        <div key={label} className={styles.priceCell}>
          <span className={styles.priceLabel}>{label}</span>
          <span className={[styles.priceValue, label === fr.detail.priceTrend ? styles.priceTrend : ""].join(" ")}>
            {v.toFixed(2)} {currency}
          </span>
        </div>
      ))}
    </div>
  );
}

function PriceBlock({ card, cm }: { card: CardRecord; cm?: CardPricing }) {
  const exact = hasExactLink(cm);
  const link = cardmarketLink(card, cm);
  const currency = cm?.currency ?? "EUR";

  const LinkButton = (
    <a className={styles.cmLink} href={link} target="_blank" rel="noopener noreferrer">
      {exact ? fr.detail.viewCardmarket : fr.detail.searchCardmarket}
      <Icon name="search" size={14} />
    </a>
  );

  // Aucune donnée : ligne très discrète, pas de gros bloc vide.
  if (!cm) {
    return (
      <div className={styles.priceLine}>
        <span className={styles.priceLineLabel}>{fr.detail.priceUnavailable}</span>
        {LinkButton}
      </div>
    );
  }

  // Donnée jugée trompeuse : pas de chiffres.
  if (cm.confidence === "unsafe") {
    return (
      <section className={styles.priceBlock}>
        <div className={styles.priceHead}>
          <h3 className={styles.sectionTitle}>{fr.detail.priceToVerify}</h3>
        </div>
        <p className={styles.priceWarn}>{fr.detail.priceUnsafe}</p>
        <div className={styles.priceFooter}>{LinkButton}</div>
      </section>
    );
  }

  if (!canShowPrice(cm)) {
    return (
      <div className={styles.priceLine}>
        <span className={styles.priceLineLabel}>{fr.detail.priceUnavailable}</span>
        {LinkButton}
      </div>
    );
  }

  const indicative = cm.confidence === "indicative";
  const title = indicative ? fr.detail.priceIndicative : fr.detail.price;
  const tag = indicative ? "Cardmarket · indicatif" : "Cardmarket";
  const date = cm.updatedAt ? new Date(cm.updatedAt).toLocaleDateString("fr-FR") : undefined;

  return (
    <section className={styles.priceBlock}>
      <div className={styles.priceHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <span className={styles.cmTag}>{tag}</span>
      </div>

      <PriceCells
        currency={currency}
        cells={[
          [fr.detail.priceLow, cm.low],
          [fr.detail.priceTrend, cm.trend],
          [fr.detail.priceAvg, cm.avg],
        ]}
      />

      {((cm.holoLow ?? 0) > 0 || (cm.holoTrend ?? 0) > 0 || (cm.holoAvg ?? 0) > 0) && (
        <>
          <span className={styles.priceSub}>{fr.detail.priceHolo}</span>
          <PriceCells
            currency={currency}
            cells={[
              [fr.detail.priceLow, cm.holoLow],
              [fr.detail.priceTrend, cm.holoTrend],
              [fr.detail.priceAvg, cm.holoAvg],
            ]}
          />
        </>
      )}

      {indicative && <p className={styles.priceMuted}>{fr.detail.priceIndicativeNote}</p>}

      <div className={styles.priceFooter}>
        {LinkButton}
        {date && <span className={styles.priceDate}>{fr.detail.priceUpdated(date)}</span>}
      </div>
    </section>
  );
}

function VersionsStrip({
  versions,
  currentId,
  onSelect,
}: {
  versions: CardBrief[];
  currentId: string;
  onSelect?: (providerId: string) => void;
}) {
  const others = versions.filter((v) => v.providerId !== currentId);
  if (!others.length || !onSelect) return null;
  return (
    <section className={styles.versions}>
      <span className={styles.versionsLabel}>
        {fr.detail.otherVersions} · {others.length}
      </span>
      <div className={styles.versionsRow}>
        {others.map((v) => (
          <button
            key={v.id}
            type="button"
            className={styles.versionItem}
            onClick={() => onSelect(v.providerId)}
            title={`${v.displayName} · ${v.localId ?? ""}`}
          >
            {v.imageUrl ? (
              <img src={v.imageUrl} alt={v.displayName} loading="lazy" className={styles.versionImg} />
            ) : (
              <span className={styles.versionFallback}>{v.localId ?? "?"}</span>
            )}
            {v.localId && <span className={styles.versionNum}>#{v.localId}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function AddToDeck({ card }: { card: CardRecord }) {
  const deckId = useDeckStore((s) => s.deckId);
  const add = useDeckStore((s) => s.add);
  const qty = useDeckStore((s) => s.cards.find((c) => c.cardId === card.id)?.quantity ?? 0);

  if (!deckId) {
    return <span className={styles.soonNote}>{fr.detail.addToDeckSoon}</span>;
  }
  return (
    <button
      type="button"
      className={styles.addBtn}
      onClick={() =>
        add({
          cardId: card.id,
          name: card.name,
          category: card.category,
          number: card.number,
          setCode: card.setId,
          imageUrl: card.imageUrl,
          rarity: card.rarity,
          subtypes: card.subtypes,
        })
      }
    >
      <Icon name="plus" size={16} />
      {fr.builder.addToDeck}
      {qty > 0 && <span className={styles.addQty}>{qty}</span>}
    </button>
  );
}

function OwnedControl({ card }: { card: CardRecord }) {
  const owned = useOwnedMap();
  const qty = owned.get(card.id) ?? 0;
  const input = { cardId: card.id, name: card.name, setCode: card.setId, number: card.number };
  return (
    <div className={[styles.owned, qty > 0 ? styles.ownedActive : ""].filter(Boolean).join(" ")}>
      <span className={styles.ownedLabel}>
        <Icon name="decks" size={15} />
        {fr.detail.owned}
      </span>
      <span className={styles.ownedStepper}>
        <button type="button" onClick={() => adjustOwned(input, -1)} disabled={qty <= 0} aria-label="Moins">
          <Icon name="minus" size={14} />
        </button>
        <span className={styles.ownedQty}>{qty}</span>
        <button type="button" onClick={() => adjustOwned(input, 1)} aria-label="Plus">
          <Icon name="plus" size={14} />
        </button>
      </span>
    </div>
  );
}

function DetailContent({
  card,
  onSelectCard,
}: {
  card: CardRecord;
  onSelectCard?: (providerId: string) => void;
}) {
  // Prix exact via pokemontcg.io (prioritaire), repli TCGdex indicatif.
  const { data: livePrice } = usePokemontcgPrice(card);
  const resolvedPrice = livePrice ?? pickCardmarket(card.pricing);
  const { data: versions } = useCardVersions(card.name);

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

        <OwnedControl card={card} />

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

        {versions && (
          <VersionsStrip versions={versions} currentId={card.providerId} onSelect={onSelectCard} />
        )}

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

        {/* Légalité */}
        {card.legalities && (
          <div className={styles.badgesRow}>
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
          </div>
        )}

        {/* Variantes (bloc séparé du prix) */}
        {activeVariants.length > 0 && (
          <div className={styles.variantsBlock}>
            <span className={styles.variantsLabel}>{fr.detail.variants}</span>
            <div className={styles.badgesRow}>
              {activeVariants.map((v) => (
                <span key={v} className={styles.variant}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}

        <AddToDeck card={card} />

        <div className={styles.footerRow}>
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

export function CardDetailModal({ providerId, onClose, onSelectCard }: CardDetailModalProps) {
  const { data, isLoading, isError } = useCardDetail(providerId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Remonte en haut quand on change de carte (ex: choix d'une autre version).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [providerId]);

  return (
    <Modal open={!!providerId} onClose={onClose} labelledBy="card-detail-title" size="lg">
      <div className={styles.scroll} ref={scrollRef}>
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
          <DetailContent card={data} onSelectCard={onSelectCard} />
        )}
      </div>
    </Modal>
  );
}
