# Prototype web : mécanique B, les bocaux

Test jouable sur téléphone de la **mécanique B** (bocaux emmêlés à débloquer), pour sentir si elle accroche plus que la règle actuelle. Mise en page et style : **référence V2** (`docs/REFERENCE-V2.md`, `concept/v2/s1-debut.png`) avec nos vrais sprites.

## Écran

- **en haut**, le chemin gris en spirale rempli de la foule de mini-créatures, par blocs de couleur (le nombre de chaque bloc au-dessus). La foule **arrive en défilant** au début du niveau, puis avance d'un cran à chaque bouchée ;
- **au milieu**, le Glouton au centre, 3 places du banc à gauche (la 1re dorée), 3 à droite (une 7e avec le booster) ;
- **en bas**, les bocaux-chariots : couvercle teinté, flèche blanche, nombre de créatures, mini-créatures derrière le verre ;
- barre du bas : Aimant, Piment, +1 place, Boutique (inactive dans ce test).

**Jouer :** https://aykxwhy.github.io/bizarre-bay-test/bocaux/ (portrait, au doigt). `?niveau=3` ouvre directement un niveau.

## Règle jouée

Celle de `docs/MECANIQUE-B.md` (PR #127, `JarGameState`), réécrite en JavaScript dans `regles.js` :

- toucher un bocal : il sort si sa ligne est vide jusqu'au bord dans le sens de sa flèche, sinon il tremble et le bocal qui gêne clignote en rouge ;
- il roule jusqu'à la première place libre du banc (6 places, la 1re « VIP » pour le décor) ;
- le Glouton mange une à une les créatures de la couleur en tête du serpent, depuis le bocal garé le plus à gauche ;
- victoire quand le serpent est vide ; défaite quand plus aucun bocal ne peut sortir (banc plein sans la bonne couleur) ;
- boosters, **2 au plus par partie**, aussi jouables depuis l'écran d'échec :
  - **aimant** : aspire depuis la grille la couleur demandée jusqu'à finir le bloc en cours ;
  - **piment** : fait sortir un bocal bloqué au choix ;
  - **+1 place** : 7e place au banc.

Différence avec le C# : ici le Glouton mange au rythme des animations (une créature toutes les 80 ms). Si on touche très vite, le banc peut se remplir avant qu'il ait fini ; le toucher est alors refusé (« Banc plein ! »), ce n'est pas une défaite.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Le jeu : dessin sur canvas, animations, sons de synthèse, vibrations |
| `regles.js` | La règle, sans affichage (utilisée par le jeu et par l'outil) |
| `levels/niveau-0N.json` | Les 6 niveaux, **au format commun avec le C#** (`width`, `jars`, `cravings`… voir `docs/MECANIQUE-B.md`) |
| `assets/` | Vrais sprites de `Game/Assets/Art/` (créatures, Glouton, boosters, pièce) et `concept/v2/bocal-chariot.png`, recadrés et réduits (moins de 1 Mo au total) |
| `outils/niveaux.mjs` | Solveur et générateur des niveaux |

Champs ajoutés au format commun, ignorés par le C# : `name`, `boosters` (stock de départ) et `check` (solution trouvée, taux de victoire).

Couleurs et créatures : rouge Tomatoque, bleu Pingouglaçon, jaune Banancoucou, vert Cactuba, violet Raisinge, orange Carottinette, rose Chewing-gnou, cyan Glouglou-baleinard.

## Les niveaux

Générés par construction à l'envers : on pose les bocaux du dernier sorti au premier, et une flèche ne vise jamais un bocal qui sortira après. Le plateau seul n'a donc pas d'interblocage. La fringale découpe le total de chaque couleur en blocs mélangés. Chaque niveau est ensuite résolu par recherche complète (sans booster).

| Niveau | Bocaux | Créatures | Gagnable | Victoire au hasard | Joueur simple* |
|---|---|---|---|---|---|
| 1. Le premier bocal (tutoriel, main qui montre) | 3 | 14 | oui | 100 % | 100 % |
| 2. Premiers bocaux | 8 | 36 | oui | 63 % | 87 % |
| 3. La pile | 12 | 58 | oui | 13 % | 57 % |
| 4. Embouteillage | 18 | 75 | oui | 1 % | 38 % |
| 5. Le grand rangement | 24 | 116 | oui | 0 % | 32 % |
| 6. Le festin | 30 | 142 | oui | 0 % | 5 % |

\* Joueur simple : touche un bocal libre de la couleur demandée s'il y en a un, sinon un bocal libre au hasard. 400 parties, sans booster. Un humain qui regarde la suite du serpent fait mieux.

```
cd prototypes/bocaux-web
node outils/niveaux.mjs verifie   # résout et mesure chaque niveau de levels/
node outils/niveaux.mjs genere    # régénère les niveaux 2 à 6 (graines fixes, ~6 min) ; le 1 est écrit à la main
```

Pour jouer les niveaux de la session C (`niveaux-bocaux/` dans la PR #127) : les copier dans `levels/` et mettre leurs noms dans la liste `NIVEAUX` en haut de `index.html`.

## Lancer en local

`fetch` des niveaux oblige à passer par un petit serveur : `python -m http.server 8791 --directory prototypes/bocaux-web`, puis http://localhost:8791.
