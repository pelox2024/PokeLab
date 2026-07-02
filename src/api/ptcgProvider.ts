/**
 * Provider pokemontcg.io — utilisé pour la RECHERCHE full-text (nom + texte des
 * attaques/talents/règles) via l'index Supabase, et pour le détail des cartes
 * `ptcg:` (celles trouvées par cette recherche).
 *
 * TCGdex reste le provider de navigation (classeur, filtres, sets). pokemontcg
 * couvre ce que TCGdex ne sait pas faire : chercher dans le texte des cartes.
 */

import { rpc } from "../lib/supabase";
import { resolveFoilStyle } from "../lib/foil";
import type {
  Ability,
  Attack,
  CardBrief,
  CardCategory,
  CardFilters,
  CardPage,
  CardQuery,
  CardRecord,
  WeakRes,
} from "./types";

const PTCG_API = "https://api.pokemontcg.io/v2/cards";

/** Ligne renvoyée par la fonction SQL search_cards. */
interface SearchRow {
  id: string;
  name: string;
  name_fr: string | null;
  supertype: string | null;
  subtypes: string[] | null;
  types: string[] | null;
  hp: number | null;
  number: string | null;
  set_id: string | null;
  set_name: string | null;
  set_ptcgo_code: string | null;
  rarity: string | null;
  image_small: string | null;
  image_large: string | null;
  release_date: string | null;
  total: number;
}

/** Catégorie « Pokémon » côté pokemontcg porte un accent. */
const CATEGORY_TO_SUPERTYPE: Record<string, string> = {
  Pokemon: "Pokémon",
  Trainer: "Trainer",
  Energy: "Energy",
};

function ptcgCategory(s: string | null | undefined): CardCategory {
  if (s === "Pokémon" || s === "Pokemon") return "Pokemon";
  if (s === "Trainer") return "Trainer";
  if (s === "Energy") return "Energy";
  return "Unknown";
}

/** Normalise les sous-types pokemontcg vers notre modèle (stage + suffixe). */
function normalizeSubtypes(subtypes?: string[]): { subtypes: string[]; suffix?: string } {
  const out: string[] = [];
  let suffix: string | undefined;
  for (const s of subtypes ?? []) {
    switch (s) {
      case "Stage 1": out.push("Stage1"); break;
      case "Stage 2": out.push("Stage2"); break;
      case "Pokémon Tool":
      case "Pokemon Tool": out.push("Tool"); break;
      case "ex":
      case "EX": suffix = "ex"; break;
      case "V": suffix = "V"; break;
      case "VMAX": out.push("VMAX"); break;
      case "VSTAR": out.push("VSTAR"); break;
      default: out.push(s);
    }
  }
  return { subtypes: out, suffix };
}

function briefFromRow(r: SearchRow): CardBrief {
  return {
    id: `ptcg:${r.id}`,
    provider: "ptcg",
    providerId: r.id,
    name: r.name, // nom canonique EN (compat decklists)
    nameEn: r.name,
    nameFr: r.name_fr ?? undefined,
    displayName: r.name,
    searchAliases: r.name_fr ? [r.name_fr] : undefined,
    localId: r.number ?? undefined,
    imageUrl: r.image_large ?? r.image_small ?? undefined,
  };
}

function mapFilters(filters?: CardFilters) {
  const category =
    filters?.categories?.length === 1 ? CATEGORY_TO_SUPERTYPE[filters.categories[0]] ?? null : null;
  return {
    p_set: null as string | null,
    p_supertype: category,
    p_types: filters?.types?.length ? filters.types : null, // noms de types alignés EN
    p_subtypes: null as string[] | null, // sous-types : valeurs divergentes, via rôles/mécaniques
    p_roles: filters?.roles?.length ? filters.roles : null,
    p_standard: filters?.standardLegal ? true : null,
    p_expanded: filters?.expandedLegal ? true : null,
  };
}

/**
 * Recherche full-text (nom EN/FR + texte des attaques/talents/règles).
 * Renvoie une page compatible avec le contrat CardProvider.
 */
export async function searchCardsFullText(query: CardQuery): Promise<CardPage> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 40;
  const rows = await rpc<SearchRow[]>("search_cards", {
    q: query.search?.trim() ?? "",
    ...mapFilters(query.filters),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  const total = rows[0]?.total ?? 0;
  const items = rows.map(briefFromRow);
  return { items, page, pageSize, total, hasMore: page * pageSize < total };
}

/* ---------- Détail d'une carte ptcg ---------- */

interface PtcgFullCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  attacks?: { name?: string; cost?: string[]; damage?: string | number; text?: string }[];
  abilities?: { name?: string; type?: string; text?: string }[];
  weaknesses?: { type: string; value?: string }[];
  resistances?: { type: string; value?: string }[];
  retreatCost?: string[];
  set?: { id?: string; name?: string; series?: string; ptcgoCode?: string };
  number?: string;
  artist?: string;
  rarity?: string;
  regulationMark?: string;
  legalities?: { standard?: string; expanded?: string };
  images?: { small?: string; large?: string };
}

function mapAttacks(c: PtcgFullCard): Attack[] | undefined {
  if (!c.attacks?.length) return undefined;
  return c.attacks.map((a) => ({
    name: a.name ?? "",
    cost: a.cost,
    damage: a.damage != null && a.damage !== "" ? String(a.damage) : undefined,
    effect: a.text,
  }));
}

function mapAbilities(c: PtcgFullCard): Ability[] | undefined {
  if (!c.abilities?.length) return undefined;
  return c.abilities.map((a) => ({ name: a.name ?? "", type: a.type, effect: a.text }));
}

function mapWeakRes(list?: { type: string; value?: string }[]): WeakRes[] | undefined {
  if (!list?.length) return undefined;
  return list.map((w) => ({ type: w.type, value: w.value }));
}

/** Récupère le détail complet d'une carte pokemontcg et le mappe en CardRecord. */
export async function getPtcgCard(providerId: string): Promise<CardRecord> {
  const res = await fetch(`${PTCG_API}/${encodeURIComponent(providerId)}`);
  if (!res.ok) throw new Error(`pokemontcg ${res.status}`);
  const json = (await res.json()) as { data?: PtcgFullCard };
  const c = json.data;
  if (!c) throw new Error("Carte introuvable");

  const { subtypes, suffix } = normalizeSubtypes(c.subtypes);
  const hp = c.hp ? parseInt(c.hp, 10) : NaN;
  const { foilStyle, hasFoilEffect } = resolveFoilStyle({ rarity: c.rarity });

  return {
    id: `ptcg:${c.id}`,
    provider: "ptcg",
    providerId: c.id,
    name: c.name,
    nameEn: c.name,
    displayName: c.name,
    category: ptcgCategory(c.supertype),
    subtypes,
    suffix,
    types: c.types ?? [],
    hp: Number.isNaN(hp) ? undefined : hp,
    setId: c.set?.id,
    setName: c.set?.name,
    number: c.number,
    rarity: c.rarity,
    regulationMark: c.regulationMark,
    imageUrl: c.images?.large ?? c.images?.small,
    attacks: mapAttacks(c),
    abilities: mapAbilities(c),
    weakness: mapWeakRes(c.weaknesses),
    resistance: mapWeakRes(c.resistances),
    retreatCost: c.retreatCost?.length,
    legalities: c.legalities
      ? { standard: c.legalities.standard === "Legal", expanded: c.legalities.expanded === "Legal" }
      : undefined,
    foilStyle,
    hasFoilEffect,
    evolveFrom: c.evolvesFrom,
    illustrator: c.artist,
    raw: c,
  };
}
