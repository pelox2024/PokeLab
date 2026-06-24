# Stratégie de filtrage — PokéLab

Objectif : une vraie recherche **facettée** pour joueurs, collectionneurs et
acheteurs Pokémon TCG, agréable desktop et mobile.

## Logique OR / AND

- **OR** entre les valeurs d'une même facette.
- **AND** entre facettes différentes.

Exemple : `(Type = Plante OU Dragon) ET (Rareté = Illustration rare OU SIR) ET
(Extension = …)`.

TCGdex supporte le **OR via `|`** dans un même champ (vérifié) :
`?types=Grass|Fire`, `?category=Pokemon|Trainer`, `?rarity=eq:Common|Uncommon`,
`?regulationMark=G|H`, `?stage=Basic|Stage1`. → **une seule requête**, l'infinite
scroll n'est pas cassé, pas d'orchestration multi-requêtes fragile.

### Sous-types : cas particulier
Les sous-types pointent vers des champs API différents (`stage`, `trainerType`,
`suffix`, `energyType`). On regroupe par champ : OR (`|`) au sein d'un même champ,
AND entre champs. Conséquences :
- `Basic + Stage 1` → `stage=Basic|Stage1` (OR, OK).
- `Item + Supporter` → `trainerType=Item|Supporter` (OR, OK).
- `Basic + ex` → `stage=Basic` ET `suffix=ex` (AND → « ex Basic », utile).
- `Basic + Item` → `stage=Basic` ET `trainerType=Item` (AND → vide, combinaison
  qui n'a pas de sens : un Pokémon n'est pas un Dresseur). Acceptable et rare.

## Facettes multi-sélection (V1)
`categories`, `types`, `subtypes`, `rarities`, `regulationMarks`. Le set reste en
sélection unique. `standardLegal` / `expandedLegal` = booléens.

```ts
interface CardFilters {
  categories?: string[];
  types?: string[];
  subtypes?: string[];
  rarities?: string[];
  regulationMarks?: string[];
  set?: string;
  standardLegal?: boolean;
  expandedLegal?: boolean;
}
```

## UX desktop
- Barre de recherche en haut, filtres rapides (catégorie, types, Standard)
  toujours visibles en chips.
- Filtres actifs affichés en chips **supprimables individuellement** + « Tout
  réinitialiser ».
- Panneau avancé **compact** (collapse animé), groupé : Carte / Compétitif /
  Collection.
- Densité Compact / Normal / Large visible. Compteur « X cartes affichées ».

## UX mobile
- Recherche accessible en haut, filtres rapides en chips scrollables.
- Bouton « Filtres » → bottom sheet : groupes accordéon, compte de filtres
  actifs, « Réinitialiser », « Appliquer » sticky. (architecture posée ;
  l'app applique les filtres en direct, le bottom sheet complet viendra avec le
  Constructeur.)

## Filtres prioritaires Pokémon
Joueurs : nom FR/EN, type, stage/subtype, légalité, regulation mark (rôles
fonctionnels = tags futurs). Collectionneurs : série, extension, rareté,
variante, illustrateur, numéro (possession/wishlist = futur). Acheteurs :
version exacte, prix fiable/indicatif, lien Cardmarket.

## Limites API connues
- TCGdex `/sets` et `/series` ne renvoient **ni date de sortie ni série** dans le
  brief. La série est déduite par **préfixe d'id** (`swsh3` → `swsh`) via la liste
  des séries. L'ordre chronologique s'appuie sur un classement de séries codé en
  dur (faute de releaseDate). Enrichissement futur possible via pokemontcg.io
  (`releaseDate`, `ptcgoCode`, `images`).
- Recherche par texte de carte / attaque / talent : possible côté API plus tard
  (`?text=`, `?attacks.name=`), non branchée en V1.

## Choix techniques
- Multi-valeurs encodées en `|` côté provider TCGdex (OR natif).
- Sous-types regroupés par champ API avant requête.
- Sets mis en cache (TanStack Query, 24 h), enrichis avec la série déduite.

## UX mobile (Lot 2.9)
Pattern retenu (validé par Baymard / Algolia / Pencil&Paper) :
- header compact, recherche, chips de catégories ; **un bouton « Filtres » ouvre
  un bottom-sheet** contenant toutes les facettes.
- bottom-sheet : groupes (Carte / Compétitif / Collection), **footer sticky**
  avec tri + « Réinitialiser » + **« Voir X cartes »** (ferme le tiroir).
- `SetPicker` en **bottom-sheet plein écran** sur mobile (fini le popover coupé),
  séries **repliables** + section « Récents ».
- modal carte : **image mise en avant** (hero) + bandeau **« Autres versions »**.

## Analyse des filtres Pokémon TCG Live (annexe)
PTCG Live (constructeur) propose, dans un bottom-sheet avec « Voir X cartes » :
- **Afficher** : Tout / Dans l'inventaire → *collection (Phase 5)*.
- **Format** : Standard / Expanded → ✅ présent.
- **Type d'énergie** : icônes rondes → ✅ présent (`TypeIcon`).
- **Faiblesse** : type de faiblesse → *à ajouter* (filtre `weaknesses.type`,
  faisabilité TCGdex à confirmer).
- **Niveau** : De base / Niveau 1 / Niveau 2 / VMAX / VSTAR → ✅ (stage) ;
  VMAX/VSTAR mappables via `suffix` (*à ajouter*).
- **Caractéristique** : **Talent (a un talent)**, Pokémon-GX/EX, Prisme Étoile,
  mécaniques d'attaque → *« a un talent »* = forte valeur, à ajouter
  (`abilities` notnull) ; les mécaniques d'attaque relèvent des **tags
  fonctionnels futurs** (draw/gust/switch/recovery).
- **Extension** : groupée par série, **multi-sélection** + « tout sélectionner »
  → ✅ groupée par série ; multi-set = *évolution future*.

Priorités d'ajout : « a un talent », faiblesse, VMAX/VSTAR, multi-set, puis tags
fonctionnels (rôles compétitifs) et « dans l'inventaire » (collection).

## Taxonomie complète (recherche : Limitless, pokemon.com, TCG Collector)

Référence compétitive (Limitless /cards/advanced) + officiel + collectionneurs.
On distingue **3 profils** et on mappe à ce que TCGdex supporte réellement
(vérifié via l'API).

### A. Carte (tous profils)
| Filtre | TCGdex | État |
|---|---|---|
| Nom (FR/EN) | `name=` | ✅ implémenté (bilingue) |
| Catégorie (Pokémon/Dresseur/Énergie) | `category=` | ✅ |
| Type d'énergie | `types=` (OR via `|`) | ✅ |
| Texte de carte | `description=` / `effect=` | 🔜 à brancher |

### B. Pokémon (joueurs)
| Filtre | TCGdex | État |
|---|---|---|
| Stage : Basic / Niveau 1 / Niveau 2 | `stage=` | ✅ |
| Mécanique : ex / V / VMAX / VSTAR | `suffix=ex\|V`, `stage=VMAX\|VSTAR` | ✅ (ajouté) |
| Mécanique : GX / Radiant / Prism / ACE SPEC | `suffix=` / rareté | 🔜 |
| Label : Tera / Ancient / Future / Fusion… | n/d direct | 🔜 (heuristique) |
| HP min/max | `hp=gte:/lte:` | ✅ supporté, UI 🔜 |
| Coût de retraite | `retreat=` | ✅ supporté, UI 🔜 |
| A un Talent | `abilities=notnull:` | ✅ supporté, UI 🔜 |
| Faiblesse (par type) | `weaknesses.type=` | ❌ non supporté |
| Numéro Pokédex | `dexId=` | ❌ peu fiable |

### C. Collection (collectionneurs)
| Filtre | TCGdex | État |
|---|---|---|
| Série | déduite (préfixe + pokemontcg) | ✅ (SetPicker) |
| Extension | `set=eq:` | ✅ |
| Rareté | `rarity=eq:` (OR) | ✅ liste réelle élargie |
| Regulation mark | `regulationMark=` | ✅ |
| Illustrateur | `illustrator=` (contient) | ✅ supporté, UI 🔜 |
| Variante (normal/holo/reverse) | `variants.*` | 🔜 |
| Langue / état / possession | — | 🔜 (Phase 5 collection) |

### D. Tournoi
| Filtre | TCGdex | État |
|---|---|---|
| Légal Standard / Expanded | `legal.standard/expanded=true` | ✅ |
| Format / rotation regulation mark | `regulationMark=` | ✅ |

### Logique du jeu retenue
- Un Pokémon n'est jamais un Dresseur : mélanger un stage (Pokémon) et un
  trainerType (Dresseur) donne un résultat vide — attendu.
- `ex`/`V` (suffix) se combinent avec un stage (ex Basic, V…) → AND utile.
- Rareté = liste **exacte** TCGdex (sinon `eq:` ne matche rien — bug corrigé :
  « Hyper rare » fonctionne, valeurs vérifiées par sondage API).

### Roadmap filtres
1. Brancher **HP min/max**, **coût de retraite**, **« a un Talent »**,
   **illustrateur** (champs déjà supportés par l'API).
2. **Recherche texte de carte** (`description`/effet).
3. **Variantes possédées** + langue/état (avec la collection, Phase 5).
4. **Tags fonctionnels** (draw/gust/switch/recovery) — dérivés du texte, V2.

> Bug corrigé : avec un filtre, on n'utilise plus le mode « classeur » set par
> set (qui restait bloqué à 0 quand les premiers sets ne contenaient aucune
> carte correspondante). On repasse en mode plat : le serveur ne renvoie que
> les cartes correspondantes, triées ensuite par set récent → ancien + numéro.
