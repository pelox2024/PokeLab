# Stratégie de prix — PokéLab

Objectif : afficher des prix **fiables** ou ne rien afficher. Jamais de prix faux
présenté comme sûr.

## État actuel (Lot 2.7)

Deux sources, par ordre de priorité :

1. **pokemontcg.io** — *source exacte, prioritaire*.
   - Fournit des prix Cardmarket **par carte exacte** + une **URL produit**
     (`https://prices.pokemontcg.io/cardmarket/<id>` qui redirige vers la bonne
     page Cardmarket).
   - Vérifié : Boss's Orders SIR (`sv2-265`) → 11,35 € (correct) ; Charizard ex
     SIR → 81,78 € ; Absol ex Power Keepers → 41 €.
   - Matching : `name:"<nom EN>" number:<n°>` puis filtrage sur le **nom
     d'extension** (robuste, indépendant des formats d'ID).
   - Appelé en **lazy** à l'ouverture de la modal, mis en cache (TanStack Query).
   - Confiance retournée : `exact`.
   - Limites : EN uniquement, **1000 req/jour / 30 par minute sans clé**. Une clé
     gratuite (`X-Api-Key`) monte à 20 000/jour — à ajouter via variable
     d'environnement / fonction Edge plus tard.

2. **TCGdex** — *repli indicatif uniquement*.
   - Champ `pricing.cardmarket` (avg/low/trend/avg7/avg30 + équivalents holo).
   - **Problème connu** : pour les cartes alternatives (SIR, full art…), TCGdex
     renvoie souvent le prix de la **version commune** (ex : SIR à 0,37 € au lieu
     de ~7 €). La variante exacte n'est pas garantie.
   - Donc plafonné à `indicative`, et basculé en `unsafe` si une carte spéciale
     a un prix plancher (< 1 €) → on **n'affiche pas** le chiffre comme fiable.
   - Pas d'URL produit exacte → bouton « Rechercher sur Cardmarket » (nom seul).

### Niveaux de confiance (`PriceConfidence`)

| Niveau | Affichage | Bouton |
|---|---|---|
| `exact` / `variant` | Prix + valeurs | « Voir sur Cardmarket » (page exacte) |
| `indicative` | « Prix indicatif » + note de prudence | « Rechercher sur Cardmarket » |
| `unsafe` | Pas de chiffre, message de prudence | « Rechercher sur Cardmarket » |
| `search_only` / `unavailable` | « Prix à vérifier / indisponible » | « Rechercher sur Cardmarket » |

## Faisabilité des autres pistes

### Cardmarket — Product Catalog / Price Guide
- Cardmarket expose un **Product Catalog** et un **Price Guide** (fichiers), mais
  via leur **API authentifiée (MKM API, OAuth)** — pas de fichier public sans
  identifiants. **Interdit côté client** (clés à protéger).
- Intérêt : `idProduct` → URL produit **exacte** + slug ; prix officiels.
- Verdict : meilleure piste **long terme** pour l'exactitude, mais nécessite un
  **backend** (Supabase Edge) pour cacher les identifiants et importer/cacher le
  catalogue. À ne pas faire en V1.

### Pokémon TCG API (pokemontcg.io)
- Déjà intégrée pour les prix (cf. ci-dessus). Bon compromis sans backend.
- Pour fiabiliser : ajouter une clé API (Edge function) et un mapping
  TCGdex id ↔ pokemontcg id mis en cache.

## Architecture Supabase (proposition — NON implémentée)

Supabase devient utile quand on aura :
- comptes utilisateurs + sync multi-appareil ;
- collection / wishlist / decks cloud ;
- **cache de prix** partagé + **mapping corrigé** TCGdex ↔ Cardmarket productId ;
- **fonctions Edge** pour cacher les clés (pokemontcg, MKM) et faire un import
  quotidien des prix.

Supabase **n'est pas nécessaire** pour : exploration de cartes, recherche TCGdex,
deck builder local V1 (tout en IndexedDB/Dexie).

Schéma futur envisagé (à valider avant création) :

```
price_cache(card_key pk, provider, currency, low, avg, trend, holo_*, source_url,
            confidence, updated_at)
cardmarket_map(tcgdex_id pk, cardmarket_product_id, cardmarket_url, verified_at)
collection(user_id, card_id, variant, quantity, language, condition, …)
wishlist(user_id, card_id, wanted_qty, max_price, priority, …)
decks(user_id, …) / deck_versions(deck_id, cards jsonb, …)
```

Edge functions : `refresh-prices` (cron quotidien), `resolve-price` (proxy
pokemontcg/MKM avec clé cachée).

## Règle produit

> Mieux vaut **ne pas afficher de prix** qu'afficher un prix faux.
> Un lien « Voir sur Cardmarket » n'est montré que si une **page produit exacte**
> est garantie ; sinon « Rechercher sur Cardmarket » (recherche par nom).
