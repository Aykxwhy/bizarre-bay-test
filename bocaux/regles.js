// Règle B (v0) des bocaux : logique pure, sans affichage.
// Utilisée par index.html (le jeu) et par outils/niveaux.mjs (solveur, générateur).
(function (racine) {
  'use strict';

  const DIRECTIONS = { haut: [0, -1], bas: [0, 1], gauche: [-1, 0], droite: [1, 0] };
  const PLACES_MAX = 7;
  const BOOSTERS_MAX = 2; // boosters utilisables par tentative (comme JarGameState.MaxBoostersPerLevel)

  // Accepte le format commun avec le C# (docs/MECANIQUE-B.md : width, jars, cravings…)
  // et le renvoie avec les noms français utilisés ici.
  function normaliser(n) {
    if (!n.jars) return n;
    return {
      id: n.id, nom: n.name || ('Niveau ' + n.id), tier: n.tier,
      largeur: n.width, hauteur: n.height, banc: n.bench || 6,
      boosters: n.boosters || { aimant: 2, piment: 2, place: 1 },
      bocaux: n.jars.map(j => ({ x: j.x, y: j.y, couleur: j.color, n: j.count, fleche: j.dir })),
      fringale: n.cravings.map(c => ({ couleur: c.color, n: c.count })),
      verification: n.check,
    };
  }

  // Crée l'état d'une partie à partir d'un niveau (format décrit dans README.md).
  function creer(niveau) {
    niveau = normaliser(niveau);
    const s = {
      largeur: niveau.largeur,
      hauteur: niveau.hauteur,
      bocaux: [],
      grille: [],
      banc: [],
      fringale: niveau.fringale.map(b => ({ couleur: b.couleur, n: b.n, total: b.n })),
      tete: 0,
      boosters: Object.assign({ aimant: 0, piment: 0, place: 0 }, niveau.boosters || {}),
      boostersUtilises: 0,
    };
    for (let y = 0; y < s.hauteur; y++) s.grille.push(new Array(s.largeur).fill(-1));
    niveau.bocaux.forEach((b, i) => {
      s.bocaux.push({ id: i, x: b.x, y: b.y, couleur: b.couleur, n: b.n, total: b.n, fleche: b.fleche, etat: 'plateau', arrive: true, place: -1 });
      s.grille[b.y][b.x] = i;
    });
    const places = niveau.banc || 6;
    for (let i = 0; i < places; i++) s.banc.push(null);
    return s;
  }

  // Premier bocal qui bloque la sortie (dans le sens de la flèche), ou -1.
  function bloqueur(s, id) {
    const b = s.bocaux[id];
    const [dx, dy] = DIRECTIONS[b.fleche];
    let x = b.x + dx, y = b.y + dy;
    while (x >= 0 && y >= 0 && x < s.largeur && y < s.hauteur) {
      if (s.grille[y][x] !== -1) return s.grille[y][x];
      x += dx; y += dy;
    }
    return -1;
  }

  function placeLibre(s) { return s.banc.indexOf(null); }

  function peutSortir(s, id) {
    return s.bocaux[id].etat === 'plateau' && bloqueur(s, id) === -1;
  }

  // Fait sortir un bocal vers la première place libre du banc.
  // Renvoie le numéro de la place, ou -1 (bloqué ou banc plein). force = piment.
  function sortir(s, id, force) {
    const b = s.bocaux[id];
    if (b.etat !== 'plateau') return -1;
    if (!force && bloqueur(s, id) !== -1) return -1;
    const p = placeLibre(s);
    if (p === -1) return -1;
    s.grille[b.y][b.x] = -1;
    b.etat = 'banc';
    b.place = p;
    s.banc[p] = id;
    return p;
  }

  function couleurTete(s) { return s.tete < s.fringale.length ? s.fringale[s.tete].couleur : null; }

  // Bocal garé (et arrivé) qui correspond à la tête du serpent : le plus à gauche.
  function bocalQuiCorrespond(s) {
    const c = couleurTete(s);
    if (c === null) return -1;
    for (const id of s.banc) {
      if (id === null) continue;
      const b = s.bocaux[id];
      if (b.arrive && b.couleur === c && b.n > 0) return id;
    }
    return -1;
  }

  // Le Glouton mange une créature. Renvoie l'événement, ou null.
  function mangerUn(s) {
    const id = bocalQuiCorrespond(s);
    if (id === -1) return null;
    const b = s.bocaux[id];
    const bloc = s.fringale[s.tete];
    b.n--; bloc.n--;
    const ev = { bocal: id, place: b.place, couleur: b.couleur, bloc: s.tete, blocFini: false, vide: false };
    if (bloc.n === 0) { s.tete++; ev.blocFini = true; }
    if (b.n === 0) { s.banc[b.place] = null; b.etat = 'parti'; ev.vide = true; }
    return ev;
  }

  function mangerTout(s) {
    const evs = [];
    let ev;
    while ((ev = mangerUn(s))) evs.push(ev);
    return evs;
  }

  function gagne(s) { return s.tete >= s.fringale.length; }

  function sortiesPossibles(s) {
    const r = [];
    for (const b of s.bocaux) if (b.etat === 'plateau' && bloqueur(s, b.id) === -1) r.push(b.id);
    return r;
  }

  // Défaite : rien à manger et plus aucun coup (banc plein, ou plus aucun bocal ne peut sortir).
  function perdu(s) {
    if (gagne(s) || bocalQuiCorrespond(s) !== -1) return false;
    if (s.bocaux.some(b => b.etat === 'banc' && !b.arrive)) return false;
    if (placeLibre(s) === -1) return 'banc';
    if (sortiesPossibles(s).length === 0) return 'bloque';
    return false;
  }

  function boosterPermis(s) { return s.boostersUtilises < BOOSTERS_MAX; }

  // Aimant (comme JarGameState.UseMagnet) : aspire, dans l'ordre des bocaux, les créatures de la couleur
  // en tête depuis les bocaux de la grille, jusqu'à finir le bloc en cours. Renvoie [{bocal, vide, blocFini}].
  function aimant(s) {
    const c = couleurTete(s);
    const prises = [];
    if (c === null) return prises;
    const bloc = s.fringale[s.tete];
    for (const b of s.bocaux) {
      if (couleurTete(s) !== c || bloc.n <= 0) break;
      if (b.etat !== 'plateau' || b.couleur !== c) continue;
      while (b.n > 0 && couleurTete(s) === c && bloc.n > 0) {
        b.n--; bloc.n--;
        const ev = { bocal: b.id, couleur: c, bloc: s.tete, blocFini: false, vide: false };
        if (bloc.n === 0) { s.tete++; ev.blocFini = true; }
        if (b.n === 0) { s.grille[b.y][b.x] = -1; b.etat = 'parti'; ev.vide = true; }
        prises.push(ev);
      }
    }
    return prises;
  }

  function placeEnPlus(s) {
    if (s.banc.length >= PLACES_MAX) return false;
    s.banc.push(null);
    return true;
  }

  // Copie profonde légère (pour le solveur).
  function copier(s) {
    return {
      largeur: s.largeur, hauteur: s.hauteur,
      bocaux: s.bocaux.map(b => Object.assign({}, b)),
      grille: s.grille.map(l => l.slice()),
      banc: s.banc.slice(),
      fringale: s.fringale.map(b => Object.assign({}, b)),
      tete: s.tete,
      boosters: Object.assign({}, s.boosters),
      boostersUtilises: s.boostersUtilises,
    };
  }

  function cle(s) {
    let k = s.tete + ':' + (s.fringale[s.tete] ? s.fringale[s.tete].n : 0) + '|';
    for (const b of s.bocaux) k += b.etat === 'plateau' ? '1' : '0';
    k += '|' + s.banc.map(id => id === null ? '_' : id + '.' + s.bocaux[id].n).sort().join(',');
    return k;
  }

  // Cherche une suite de touchers gagnante, sans booster. Renvoie {ok, coups, noeuds}.
  function resoudre(niveau, limite) {
    limite = limite || 300000;
    const vus = new Set();
    let noeuds = 0;
    const depart = creer(niveau);
    mangerTout(depart);
    function dfs(s, chemin) {
      if (gagne(s)) return chemin;
      if (++noeuds > limite) return null;
      const k = cle(s);
      if (vus.has(k)) return null;
      vus.add(k);
      if (placeLibre(s) === -1) return null;
      const c = couleurTete(s);
      const coups = sortiesPossibles(s).sort((a, b) => (s.bocaux[b].couleur === c) - (s.bocaux[a].couleur === c));
      for (const id of coups) {
        const t = copier(s);
        sortir(t, id);
        mangerTout(t);
        const r = dfs(t, chemin.concat(id));
        if (r) return r;
      }
      return null;
    }
    const coups = dfs(depart, []);
    return { ok: !!coups, coups: coups || [], noeuds, limiteAtteinte: noeuds > limite };
  }

  // Joue n parties au hasard (touchers aléatoires parmi les sorties possibles, sans booster).
  // glouton = proportion de coups « malins » (couleur de tête d'abord). Renvoie le taux de victoire.
  function tauxVictoire(niveau, n, glouton, alea) {
    alea = alea || Math.random;
    let v = 0;
    for (let i = 0; i < n; i++) {
      const s = creer(niveau);
      mangerTout(s);
      while (!gagne(s) && !perdu(s)) {
        let coups = sortiesPossibles(s);
        const c = couleurTete(s);
        const bons = coups.filter(id => s.bocaux[id].couleur === c);
        if (bons.length && alea() < glouton) coups = bons;
        sortir(s, coups[Math.floor(alea() * coups.length)]);
        mangerTout(s);
      }
      if (gagne(s)) v++;
    }
    return v / n;
  }

  const Regles = {
    DIRECTIONS, PLACES_MAX, BOOSTERS_MAX, normaliser, boosterPermis, creer, bloqueur, placeLibre, peutSortir, sortir, couleurTete,
    bocalQuiCorrespond, mangerUn, mangerTout, gagne, perdu, sortiesPossibles, aimant,
    placeEnPlus, copier, cle, resoudre, tauxVictoire,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Regles;
  else racine.Regles = Regles;
})(typeof window !== 'undefined' ? window : globalThis);
