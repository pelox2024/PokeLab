// PokéLab — fonction d'ingestion de l'index de recherche.
//
// Alimente public.cards depuis pokemontcg.io (nom + texte des attaques/talents/
// règles, EN) et mappe les noms FR via un dictionnaire construit depuis TCGdex.
// Chunkée pour tenir dans les limites de temps : on l'appelle par lots de pages.
//
// Étapes (query param `step`) :
//   ?step=dict                    -> construit le dictionnaire nom EN -> nom FR
//   ?step=cards&page=N&pages=P    -> ingère P pages (250 cartes) à partir de N
//   ?step=vocab                   -> rafraîchit le vocabulaire (correction fautes)

import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface PtcgCard {
  id: string; name: string; supertype?: string; subtypes?: string[]; types?: string[];
  hp?: string; number?: string; rarity?: string; regulationMark?: string;
  images?: { small?: string; large?: string };
  set?: { id?: string; name?: string; series?: string; ptcgoCode?: string; releaseDate?: string };
  legalities?: { standard?: string; expanded?: string };
  attacks?: { name?: string; text?: string }[];
  abilities?: { name?: string; text?: string }[];
  rules?: string[];
  flavorText?: string;
  nationalPokedexNumbers?: number[];
}

const joinTxt = (arr?: { name?: string; text?: string }[]) =>
  (arr ?? []).map((x) => `${x.name ?? ""} ${x.text ?? ""}`.trim()).join(" \n ");

function toRow(c: PtcgCard, fr: Map<string, string>) {
  const rd = c.set?.releaseDate ? c.set.releaseDate.replaceAll("/", "-") : null;
  return {
    id: c.id,
    name: c.name,
    name_fr: fr.get(c.name) ?? null,
    supertype: c.supertype ?? null,
    subtypes: c.subtypes ?? [],
    types: c.types ?? [],
    hp: c.hp && /^\d+$/.test(c.hp) ? Number(c.hp) : null,
    number: c.number ?? null,
    set_id: c.set?.id ?? null,
    set_name: c.set?.name ?? null,
    set_series: c.set?.series ?? null,
    set_ptcgo_code: c.set?.ptcgoCode ?? null,
    rarity: c.rarity ?? null,
    regulation_mark: c.regulationMark ?? null,
    image_small: c.images?.small ?? null,
    image_large: c.images?.large ?? null,
    release_date: rd,
    national_pokedex: c.nationalPokedexNumbers ?? [],
    legal_standard: c.legalities?.standard === "Legal",
    legal_expanded: c.legalities?.expanded === "Legal",
    attacks_text: joinTxt(c.attacks),
    abilities_text: joinTxt(c.abilities),
    rules_text: (c.rules ?? []).join(" \n "),
    flavor_text: c.flavorText ?? "",
    updated_at: new Date().toISOString(),
  };
}

async function buildDict() {
  const [en, frx] = await Promise.all([
    fetch("https://api.tcgdex.net/v2/en/cards?pagination:itemsPerPage=100000").then((r) => r.json()),
    fetch("https://api.tcgdex.net/v2/fr/cards?pagination:itemsPerPage=100000").then((r) => r.json()),
  ]);
  const frById = new Map<string, string>();
  for (const c of frx as { id: string; name: string }[]) if (c.name) frById.set(c.id, c.name);
  const dict = new Map<string, string>();
  for (const c of en as { id: string; name: string }[]) {
    const f = frById.get(c.id);
    if (c.name && f && f !== c.name && !dict.has(c.name)) dict.set(c.name, f);
  }
  const rows = [...dict].map(([name_en, name_fr]) => ({ name_en, name_fr }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from("name_fr_dict").upsert(rows.slice(i, i + 1000), { onConflict: "name_en" });
    if (error) throw error;
  }
  return rows.length;
}

async function ingestCards(page: number, pages: number) {
  const { data: dictRows, error: de } = await sb.from("name_fr_dict").select("name_en,name_fr");
  if (de) throw de;
  const fr = new Map<string, string>();
  for (const r of dictRows ?? []) fr.set(r.name_en, r.name_fr);

  const select = [
    "id", "name", "supertype", "subtypes", "types", "hp", "number", "rarity",
    "regulationMark", "images", "set", "legalities", "attacks", "abilities",
    "rules", "flavorText", "nationalPokedexNumbers",
  ].join(",");

  let inserted = 0;
  let done = false;
  let last = page;
  let total = 0;
  for (let i = 0; i < pages; i++) {
    const p = page + i;
    last = p;
    const url = `https://api.pokemontcg.io/v2/cards?page=${p}&pageSize=250&select=${select}`;
    const res = await fetch(url).then((r) => r.json());
    const data: PtcgCard[] = res.data ?? [];
    total = res.totalCount ?? total;
    if (data.length === 0) { done = true; break; }
    const rows = data.map((c) => toRow(c, fr));
    const { error } = await sb.from("cards").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    inserted += rows.length;
    if (data.length < 250) { done = true; break; }
  }
  return { inserted, done, nextPage: done ? null : last + 1, total };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const step = url.searchParams.get("step") ?? "cards";
    if (step === "dict") {
      return json({ ok: true, step, dictEntries: await buildDict() });
    }
    if (step === "vocab") {
      // Post-traitement : vocabulaire (correction de fautes) + rôles deckbuilding.
      const { data, error } = await sb.rpc("refresh_search_vocab");
      if (error) throw error;
      const { error: e2 } = await sb.rpc("classify_roles");
      if (e2) throw e2;
      return json({ ok: true, step, vocabAdded: data });
    }
    const page = Number(url.searchParams.get("page") ?? "1");
    const pages = Math.min(20, Number(url.searchParams.get("pages") ?? "8"));
    return json({ ok: true, step, ...(await ingestCards(page, pages)) });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
