# PokéLab — backend de recherche (Supabase)

Index de recherche full-text des cartes, à la façon de Pokémon TCG Live /
Scryfall : un index propre plutôt que des requêtes en direct sur une API
publique (TCGdex ne sait pas chercher dans le texte des cartes côté serveur).

- **Projet Supabase** : `pokelab` (région `eu-central-1`).
- **Source des données** : pokemontcg.io (nom + texte des attaques/talents/règles,
  EN) ; noms FR mappés via un dictionnaire construit depuis TCGdex.
- **Cartes exposées** : identifiants `ptcg:{id}` côté application.

## Fichiers

- `schema.sql` — schéma complet (table `cards`, index, `search_vocab`,
  fonctions `build_search_query`, `search_cards`, `refresh_search_vocab`, RLS).
  Source de vérité versionnée.
- `functions/ingest/index.ts` — fonction edge d'ingestion (chunkée).

## Recherche

`search_cards(q, …)` combine :

1. **Préfixe + ET + ordre libre** — chaque mot saisi est un préfixe (`mot:*`),
   dans n'importe quel ordre et à n'importe quelle position (`build_search_query`).
   Gère la frappe au fil de l'eau (« put dam », « draw supp »).
2. **Tolérance aux fautes** — chaque mot est comparé au vocabulaire du corpus
   (trigrammes `pg_trgm`) ; une correction est ajoutée en OR (jamais à la place
   du littéral) → « dammage » → damage, « dracaufue » → Dracaufeu.
3. **Classement** — correspondances de nom d'abord, puis cartes jouables
   (Standard), puis les plus récentes.

Tokeniseur `simple` (sans stemming) partout pour un préfixe cohérent nom + texte.

## Ingestion / rafraîchissement (nouvelle extension)

Fonction edge `ingest` (JWT requis), appelée par étapes :

```bash
BASE="https://<ref>.supabase.co/functions/v1/ingest"
AUTH="Authorization: Bearer <anon JWT>"   # clé anon (JWT), pas la clé publishable

# 1) Dictionnaire nom EN -> FR (depuis TCGdex)
curl -X POST "$BASE?step=dict" -H "$AUTH"

# 2) Cartes (par lots de pages de 250 ; répéter avec nextPage jusqu'à done)
curl -X POST "$BASE?step=cards&page=1&pages=10" -H "$AUTH"

# 3) Vocabulaire (correction de fautes) — après l'ingestion des cartes
curl -X POST "$BASE?step=vocab" -H "$AUTH"
```

## Configuration côté app

`src/lib/supabase.ts` lit `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, avec
repli sur l'URL + la clé **publishable** (publique, lecture seule protégée par
RLS) pour que le déploiement Vercel fonctionne sans configuration.
