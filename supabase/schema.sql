-- PokéLab — schéma de l'index de recherche full-text (Supabase / Postgres).
-- Source de vérité versionnée du backend de recherche. Projet : « pokelab ».
--
-- Modèle (façon TCG Live / Scryfall) : un index propre des cartes pokemontcg.io
-- (exposées « ptcg:{id} » côté app), noms EN + FR, texte des attaques/talents/
-- règles (EN), et un tag de RÔLE deckbuilding par carte. Recherche moderne :
-- préfixe (as-you-type), multi-mots ordre libre, tolérance aux fautes, glossaire
-- FR -> EN, filtres par rôle/mécanique.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ── Table des cartes ───────────────────────────────────────────────────────
create table if not exists public.cards (
  id               text primary key,
  name             text not null,
  name_fr          text,
  supertype        text,
  subtypes         text[] default '{}',
  types            text[] default '{}',
  hp               int,
  number           text,
  set_id           text,
  set_name         text,
  set_series       text,
  set_ptcgo_code   text,
  rarity           text,
  regulation_mark  text,
  image_small      text,
  image_large      text,
  release_date     date,
  national_pokedex int[] default '{}',
  legal_standard   boolean default false,
  legal_expanded   boolean default false,
  attacks_text     text default '',
  abilities_text   text default '',
  rules_text       text default '',
  flavor_text      text default '',
  roles            text[] default '{}',   -- rôles deckbuilding + mécaniques (classify_roles)
  updated_at       timestamptz default now(),
  -- Tokeniseur 'simple' partout : le préfixe :* est cohérent nom + texte, et
  -- couvre pluriels/variantes (« damage:* » matche damage/damages/damaged…).
  search_doc tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name_fr, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(attacks_text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(abilities_text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(rules_text, '')), 'C')
  ) stored
);

create index if not exists cards_search_idx  on public.cards using gin (search_doc);
create index if not exists cards_roles_idx    on public.cards using gin (roles);
create index if not exists cards_name_trgm   on public.cards using gin (name gin_trgm_ops);
create index if not exists cards_namefr_trgm on public.cards using gin (coalesce(name_fr, '') gin_trgm_ops);
create index if not exists cards_set_idx     on public.cards (set_id);
create index if not exists cards_release_idx on public.cards (release_date desc nulls last);

-- Dictionnaire nom EN -> nom FR (construit depuis TCGdex à l'ingestion).
create table if not exists public.name_fr_dict (
  name_en text primary key,
  name_fr text not null
);

-- Vocabulaire du corpus (mots réels) pour la correction de fautes.
create table if not exists public.search_vocab (word text primary key);
create index if not exists search_vocab_trgm on public.search_vocab using gin (word gin_trgm_ops);

-- Glossaire d'effets FR -> EN (le texte des cartes est en anglais).
create table if not exists public.fr_en_glossary (fr text primary key, en text not null);
-- Amorçage : voir migration fr_en_glossary_query_builder (degats->damage,
-- soigne->heal, banc->bench, talent->ability, pioche->draw, defausse->discard…).

alter table public.cards enable row level security;
alter table public.name_fr_dict enable row level security;
drop policy if exists cards_public_read on public.cards;
create policy cards_public_read on public.cards for select to anon, authenticated using (true);

-- ── Rafraîchissements (appelés par la fonction edge `ingest`, ?step=vocab) ──
create or replace function public.refresh_search_vocab()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.search_vocab (word)
  select word from ts_stat('select search_doc from public.cards')
  where word ~ '^[a-z0-9]{2,}$'
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.refresh_search_vocab() from anon, authenticated;

-- Classe chaque carte par RÔLE (fonction) + MÉCANIQUE (structure). Re-jouable.
create or replace function public.classify_roles()
returns void language sql as $$
  update public.cards c set roles = (
    select array_remove(array[
      case when t ~ 'draw .*card' then 'draw' end,
      case when t ~ 'search your deck for .*(pok|basic)' then 'search-pokemon' end,
      case when t ~ 'search your deck for' then 'search' end,
      case when (t ~ 'attach .*energy.* from your (deck|discard)') or (ab ~ 'attach .*energy') then 'energy-accel' end,
      case when (t ~ 'switch .*opponent') or (t ~ 'opponent.*benched pok.*active') then 'gust' end,
      case when t ~ 'switch your (active )?pok' then 'switch' end,
      case when (t ~ 'damage to .*opponent.*benched') or (t ~ 'damage counters on .*opponent.*bench') then 'bench-damage' end,
      case when ab ~ 'damage counter' then 'spread-ability' end,
      case when t ~ 'opponent.*(shuffle|discard|reveal).*hand' then 'hand-disrupt' end,
      case when t ~ 'heal' then 'heal' end,
      case when (t ~ 'prevent .*damage') or (t ~ 'reduce .*damage') then 'protect' end,
      case when t ~ 'discard pile.*hand' then 'recovery' end,
      case when c.subtypes && array['ex','EX'] then 'ex' end,
      case when c.subtypes && array['V'] then 'v' end,
      case when c.subtypes && array['VSTAR'] then 'vstar' end,
      case when c.subtypes && array['VMAX'] then 'vmax' end,
      case when c.subtypes && array['Tera'] then 'tera' end,
      case when c.subtypes && array['ACE SPEC'] then 'acespec' end,
      case when coalesce(c.abilities_text, '') <> '' then 'ability' end
    ], null)
    from (
      select
        lower(c.name || ' ' || coalesce(c.attacks_text, '') || ' ' || coalesce(c.abilities_text, '') || ' ' || coalesce(c.rules_text, '')) as t,
        lower(coalesce(c.abilities_text, '')) as ab
    ) s
  );
$$;

-- ── Construction de la tsquery « recherche moderne » ───────────────────────
-- Chaque mot = préfixe (as-you-type, ordre/position libres). Glossaire FR -> EN
-- et correction de fautes ajoutés en OR (jamais en substitution).
create or replace function public.build_search_query(q text)
returns tsquery language plpgsql stable as $$
declare
  raw text; tok text; key text; eng text; corrected text; sim real;
  parts text[] := '{}';
begin
  for raw in select unnest(regexp_split_to_array(lower(btrim(coalesce(q, ''))), '\s+')) loop
    tok := regexp_replace(raw, '[^0-9a-zà-ÿ]', '', 'g');
    if length(tok) = 0 then continue; end if;
    key := unaccent(tok);

    eng := null;
    select g.en into eng from public.fr_en_glossary g where g.fr = key;
    if eng is not null and eng <> tok then
      parts := parts || ('(' || tok || ':* | ' || eng || ':*)');
      continue;
    end if;

    corrected := null;
    if not exists (select 1 from public.search_vocab v where v.word like tok || '%') then
      select v.word, similarity(v.word, tok) into corrected, sim
      from public.search_vocab v
      where v.word % tok and v.word <> tok
      order by similarity(v.word, tok) desc limit 1;
      if corrected is null or coalesce(sim, 0) < 0.4 then corrected := null; end if;
    end if;

    if corrected is not null then
      parts := parts || ('(' || tok || ':* | ' || corrected || ':*)');
    else
      parts := parts || (tok || ':*');
    end if;
  end loop;

  if array_length(parts, 1) is null then return null; end if;
  return to_tsquery('simple', array_to_string(parts, ' & '));
end;
$$;
grant execute on function public.build_search_query to anon, authenticated;

-- ── Recherche des cartes ───────────────────────────────────────────────────
create or replace function public.search_cards(
  q              text    default '',
  p_set          text    default null,
  p_supertype    text    default null,
  p_types        text[]  default null,
  p_subtypes     text[]  default null,
  p_standard     boolean default null,
  p_expanded     boolean default null,
  p_roles        text[]  default null,
  p_limit        int     default 40,
  p_offset       int     default 0
)
returns table (
  id text, name text, name_fr text, supertype text, subtypes text[], types text[],
  hp int, number text, set_id text, set_name text, set_ptcgo_code text, rarity text,
  image_small text, image_large text, release_date date, total bigint
)
language sql stable as $$
  with q_norm as (select nullif(btrim(q), '') as term),
  pq as (select public.build_search_query((select term from q_norm)) as tsq),
  filtered as (
    select c.*,
      (
        (select term from q_norm) is not null and (
          c.name ilike '%' || (select term from q_norm) || '%'
          or coalesce(c.name_fr, '') ilike '%' || (select term from q_norm) || '%'
        )
      ) as name_hit
    from public.cards c
    where
      (
        (select term from q_norm) is null
        or c.search_doc @@ (select tsq from pq)
        or c.name ilike '%' || (select term from q_norm) || '%'
        or coalesce(c.name_fr, '') ilike '%' || (select term from q_norm) || '%'
      )
      and (p_set is null or c.set_id = p_set)
      and (p_supertype is null or c.supertype = p_supertype)
      and (p_types is null or c.types && p_types)
      and (p_subtypes is null or c.subtypes && p_subtypes)
      and (p_roles is null or c.roles @> p_roles)   -- ET entre rôles (cumulatif)
      and (p_standard is null or c.legal_standard = p_standard)
      and (p_expanded is null or c.legal_expanded = p_expanded)
  )
  select
    f.id, f.name, f.name_fr, f.supertype, f.subtypes, f.types, f.hp, f.number,
    f.set_id, f.set_name, f.set_ptcgo_code, f.rarity, f.image_small, f.image_large,
    f.release_date, count(*) over() as total
  from filtered f
  order by
    f.name_hit desc,                -- correspondances de nom d'abord
    f.legal_standard desc,          -- puis cartes jouables (Standard)
    f.release_date desc nulls last, -- puis les plus récentes
    f.name asc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
$$;
grant execute on function public.search_cards to anon, authenticated;
