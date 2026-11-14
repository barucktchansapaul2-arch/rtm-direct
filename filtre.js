// RTM en direct — filtre des commentaires (insultes, grossièretés, liens, cris)
// Utilisé par l'appli, par la page de modération et par les tests.
(function (racine) {
  "use strict";

  // Mots refusés. « court » = seulement en mot entier (sinon « con » bloquerait « content »).
  const LONGS = [
    "connard", "connasse", "conard", "salope", "salaud", "putain", "encule", "enkule", "batard", "nique", "niquer",
    "ntm", "fdp", "tapette", "pouffiasse", "petasse", "trouduc", "bougnoule", "negro", "sale race", "ta gueule",
    "ferme ta gueule", "fils de pute", "va te faire", "ta mere la", "ta race",
    "fuck", "motherfucker", "bitch", "asshole", "bastard", "nigger", "nigga",
    "malaya", "msenge", "mshenzi", "shenzi", "kumamako", "kuma mayo", "kuma nyoko", "mavi yako", "umbwa wewe",
    "libolo", "makata", "soki mama", "mama na yo", "zoba mabe",
  ];
  const COURTS = ["con", "cons", "conne", "pute", "putes", "pd", "pede", "merde", "chier", "bite", "couille", "couilles",
    "shit", "dick", "pussy", "cunt", "kuma", "mboo", "mavi", "zoba", "mbwa mabe", "sot"];

  const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "€": "e", "!": "i" };

  function normaliser(texte) {
    let t = String(texte || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    t = t.replace(/[0134578@$€!]/g, (c) => LEET[c] || c);
    t = t.replace(/[^a-z\s]/g, " ");               // ponctuation, points glissés entre les lettres…
    t = t.replace(/([a-z])\1{2,}/g, "$1");         // « connnnard » -> « conard »… puis lettres doublées :
    return t.replace(/\s+/g, " ").trim();
  }

  function motInterdit(texte) {
    const n = normaliser(texte);
    const serre = n.replace(/([a-z])\1+/g, "$1");          // sans lettres doublées
    const colle = serre.replace(/(?<=\b[a-z]) (?=[a-z]\b)/g, "");   // « c o n n a r d » -> « conard »
    for (const variante of [n, serre, colle]) {
      for (const m of LONGS) {
        const cible = m.replace(/([a-z])\1+/g, "$1");
        if (variante.includes(m) || variante.includes(cible)) return m;
      }
      const mots = " " + variante + " ";
      for (const m of COURTS) if (mots.includes(" " + m + " ")) return m;
    }
    return null;
  }

  // Renvoie null si le commentaire est acceptable, sinon la raison (à montrer à l'utilisateur).
  function verifier(texte, nom) {
    const t = String(texte || "").trim();
    if (!t) return "Écrivez un message.";
    if (t.length > 300) return "Message trop long (300 caractères au maximum).";
    if (nom !== undefined) {
      const n = String(nom || "").trim();
      if (n.length < 2 || n.length > 30) return "Choisissez un nom de 2 à 30 caractères.";
      if (motInterdit(n)) return "Ce nom n'est pas accepté.";
    }
    if (motInterdit(t)) return "Ce message contient un mot qui n'est pas accepté ici. Restons respectueux.";
    if (/(https?:\/\/|www\.|\.com\b|\.net\b|wa\.me|t\.me)/i.test(t)) return "Les liens ne sont pas acceptés dans les commentaires.";
    if (/(\+?\d[\s.-]?){9,}/.test(t)) return "Les numéros de téléphone ne sont pas acceptés dans les commentaires.";
    const lettres = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (lettres.length >= 12 && lettres === lettres.toUpperCase()) return "Merci de ne pas écrire tout en majuscules.";
    if (/(.)\1{7,}/.test(t)) return "Merci d'éviter les répétitions.";
    return null;
  }

  // Expression pour les règles de sécurité Firestore (2e barrière, côté serveur)
  function expressionRegles() {
    // lower() de Firestore ne met pas « É » en minuscule : on liste aussi les majuscules accentuées
    const acc = (m) => m.replace(/e/g, "[eéèêë3ÉÈÊË]").replace(/a/g, "[aàâ4@ÀÂ]").replace(/o/g, "[oô0Ô]")
      .replace(/i/g, "[iîï1ÎÏ]").replace(/u/g, "[uùûÙÛ]").replace(/ /g, "[^a-z]*");
    const longs = LONGS.map(acc).join("|");
    const courts = COURTS.map(acc).join("|");
    return `.*(${longs}).*|(.*[^a-zà-ÿ])?(${courts})([^a-zà-ÿ].*)?`;
  }

  const api = { normaliser, motInterdit, verifier, expressionRegles, LONGS, COURTS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.RTMFiltre = api;
})(typeof self !== "undefined" ? self : this);
