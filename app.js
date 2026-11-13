// RTM en direct — application web installable (iPhone, Android, ordinateur)
// Développée par l'ingénieur BARUCK TCHANSA PAUL.
"use strict";

const FUSEAU = "Africa/Lubumbashi";          // heure de Moba (UTC+2)
const $ = (id) => document.getElementById(id);
let config = { nom: "RTM", chaine_id: "", video_id: "", lien: "" };
let programme = { semaine: [], weekend: [], evenements: [] };
let jourAffiche = 0;                            // 0 = aujourd'hui, 1 = demain

// ---- heure de Moba, quel que soit le réglage du téléphone
function maintenantMoba() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: FUSEAU, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" }).formatToParts(new Date());
  const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
  const jours = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return { date: `${v.year}-${v.month}-${v.day}`, minutes: (+v.hour % 24) * 60 + +v.minute, secondes: +v.second,
    jour: jours[v.weekday], heure: `${v.hour === "24" ? "00" : v.hour}:${v.minute}` };
}
const enMinutes = (h) => { const m = /^(\d{1,2})h(\d{2})$/.exec(String(h).trim()); return m ? +m[1] * 60 + +m[2] : NaN; };
const enHeure = (mn) => `${String(Math.floor(mn / 60) % 24).padStart(2, "0")}h${String(mn % 60).padStart(2, "0")}`;
function decaleDate(iso, jours) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + jours); return d.toISOString().slice(0, 10);
}

// ---- grille d'un jour (les programmes spéciaux remplacent la grille sur leur créneau)
function grilleDuJour(dateIso, jourSemaine) {
  const base = (jourSemaine >= 5 && programme.weekend.length ? programme.weekend : programme.semaine)
    .map((t) => ({ d: enMinutes(t.debut), f: enMinutes(t.fin), p: t.programme }))
    .filter((t) => !isNaN(t.d) && !isNaN(t.f) && t.f > t.d);
  let liste = base;
  for (const e of programme.evenements || []) {
    if (e.date !== dateIso) continue;
    const d = enMinutes(e.debut), f = enMinutes(e.fin);
    if (isNaN(d) || isNaN(f) || f <= d) continue;
    const garde = [];
    for (const t of liste) {
      if (t.f <= d || t.d >= f) { garde.push(t); continue; }
      if (t.d < d) garde.push({ d: t.d, f: d, p: t.p });
      if (t.f > f) garde.push({ d: f, f: t.f, p: t.p });
    }
    garde.push({ d, f, p: e.programme, special: true });
    liste = garde;
  }
  return liste.sort((a, b) => a.d - b.d);
}

function afficherProgramme() {
  const t = maintenantMoba();
  const auj = grilleDuJour(t.date, t.jour);
  const enCours = auj.find((x) => x.d <= t.minutes && t.minutes < x.f);
  let suivant = auj.find((x) => x.d > t.minutes);
  if (!suivant) {
    const dem = grilleDuJour(decaleDate(t.date, 1), (t.jour + 1) % 7);
    suivant = dem[0] ? { ...dem[0], demain: true } : null;
  }
  $("horloge").textContent = t.heure;
  $("maintenant-nom").textContent = enCours ? enCours.p : "Fin des programmes";
  $("maintenant-heure").textContent = enCours ? `${enHeure(enCours.d)} – ${enHeure(enCours.f)}` : "L'antenne reprend demain matin";
  $("jauge").style.width = enCours ? `${Math.min(100, ((t.minutes + t.secondes / 60 - enCours.d) / (enCours.f - enCours.d)) * 100)}%` : "0";
  $("suivant-nom").textContent = suivant ? suivant.p : "—";
  $("suivant-heure").textContent = suivant ? `${suivant.demain ? "demain " : ""}à ${enHeure(suivant.d)}` : "";

  const liste = jourAffiche === 0 ? auj : grilleDuJour(decaleDate(t.date, 1), (t.jour + 1) % 7);
  const ol = $("programme");
  ol.textContent = "";
  if (!liste.length) {
    const li = document.createElement("li"); li.textContent = "Programme non communiqué."; ol.appendChild(li);
  }
  for (const x of liste) {
    const li = document.createElement("li");
    if (jourAffiche === 0 && x.f <= t.minutes) li.className = "passe";
    if (jourAffiche === 0 && x === enCours) li.className = "encours";
    if (x.special) li.classList.add("special");
    const h = document.createElement("span"); h.className = "h"; h.textContent = `${enHeure(x.d)} – ${enHeure(x.f)}`;
    const p = document.createElement("span"); p.className = "p"; p.textContent = x.p;
    li.append(h, p); ol.appendChild(li);
  }
  const actif = ol.querySelector(".encours");
  if (actif && !afficherProgramme.dejaCentre) { afficherProgramme.dejaCentre = true; }
}

// ---- lecteur du direct (lecteur officiel YouTube)
function adresseLecteur() {
  const options = "autoplay=1&playsinline=1&rel=0&modestbranding=1";
  if (/^UC[\w-]{22}$/.test(config.chaine_id || "")) return `https://www.youtube.com/embed/live_stream?channel=${config.chaine_id}&${options}`;
  if (/^[\w-]{11}$/.test(config.video_id || "")) return `https://www.youtube.com/embed/${config.video_id}?${options}`;
  return "";
}
function chargerLecteur() {
  const zone = $("lecteur");
  const ancien = zone.querySelector("iframe");
  if (ancien) ancien.remove();
  const adresse = adresseLecteur();
  if (!adresse) {
    $("attente").hidden = false;
    $("attente-texte").textContent = "Le direct de RTM arrive bientôt ici. Revenez dans quelques jours !";
    $("badge").textContent = "BIENTÔT"; $("badge").classList.add("hors");
    return;
  }
  if (!navigator.onLine) {
    $("attente").hidden = false;
    $("attente-texte").textContent = "Pas de connexion internet. Le direct reprendra dès que la connexion revient.";
    return;
  }
  const f = document.createElement("iframe");
  f.src = adresse;
  f.title = "RTM en direct";
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  f.referrerPolicy = "strict-origin-when-cross-origin";
  f.addEventListener("load", () => { $("attente").hidden = true; });
  zone.appendChild(f);
  $("badge").textContent = "● EN DIRECT"; $("badge").classList.remove("hors");
}

async function lireJson(fichier, defaut) {
  try {
    const r = await fetch(`${fichier}?t=${Math.floor(Date.now() / 300000)}`, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) { return defaut; }
}

async function demarrer() {
  // les boutons d'abord, le réseau ensuite
  $("recharger").addEventListener("click", chargerLecteur);
  $("onglet-auj").addEventListener("click", () => { jourAffiche = 0; onglets(); });
  $("onglet-dem").addEventListener("click", () => { jourAffiche = 1; onglets(); });
  $("partager").addEventListener("click", partager);
  const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  $("installer-aide").textContent = installee ? "" : iphone
    ? "Pour installer : dans Safari, touchez Partager puis « Sur l'écran d'accueil »."
    : "Pour installer : menu du navigateur puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».";
  afficherProgramme();

  const [c, p] = await Promise.all([lireJson("config.json", config), lireJson("programme.json", programme)]);
  if (c && typeof c === "object") config = { ...config, ...c };
  if (p && typeof p === "object") programme = { semaine: p.semaine || [], weekend: p.weekend || [], evenements: p.evenements || [] };
  if (/^https:\/\/(www\.)?youtube\.com\//.test(config.lien || "")) { $("lien-youtube").href = config.lien; $("lien-youtube").hidden = false; }
  chargerLecteur();
  afficherProgramme();
  setInterval(afficherProgramme, 15000);
  setInterval(async () => {                      // la grille peut changer : on la relit toutes les 10 min
    const n = await lireJson("programme.json", null);
    if (n && n.semaine) { programme = { semaine: n.semaine, weekend: n.weekend || [], evenements: n.evenements || [] }; afficherProgramme(); }
  }, 600000);
  window.addEventListener("online", chargerLecteur);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
function onglets() {
  $("onglet-auj").classList.toggle("actif", jourAffiche === 0);
  $("onglet-dem").classList.toggle("actif", jourAffiche === 1);
  afficherProgramme();
}
async function partager() {
  const donnees = { title: "RTM en direct", text: "Regardez R.T.M Radio Télévision Moba en direct sur votre téléphone.", url: location.href.split("#")[0] };
  try {
    if (navigator.share) await navigator.share(donnees);
    else { await navigator.clipboard.writeText(donnees.url); $("partager").textContent = "Lien copié ✔"; }
  } catch (e) { /* partage annulé */ }
}
demarrer();
