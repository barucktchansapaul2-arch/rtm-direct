// RTM en direct — application web installable (iPhone, Android, ordinateur)
// Développée par l'ingénieur BARUCK TCHANSA PAUL.
"use strict";

const FUSEAU = "Africa/Lubumbashi";          // heure de Moba (UTC+2)
const $ = (id) => document.getElementById(id);
let config = { nom: "RTM", chaine_id: "", video_id: "", lien: "" };

// ---- heure de Moba, quel que soit le réglage du téléphone
function maintenantMoba() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: FUSEAU, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" }).formatToParts(new Date());
  const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
  const jours = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return { date: `${v.year}-${v.month}-${v.day}`, minutes: (+v.hour % 24) * 60 + +v.minute, secondes: +v.second,
    jour: jours[v.weekday], heure: `${v.hour === "24" ? "00" : v.hour}:${v.minute}` };
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

function horloge() { $("horloge").textContent = maintenantMoba().heure; }

async function demarrer() {
  // les boutons d'abord, le réseau ensuite
  $("recharger").addEventListener("click", chargerLecteur);
  $("partager").addEventListener("click", partager);
  const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  $("installer-aide").textContent = installee ? "" : iphone
    ? "Pour installer : dans Safari, touchez Partager puis « Sur l'écran d'accueil »."
    : "Pour installer : menu du navigateur puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».";
  horloge();
  setInterval(horloge, 15000);

  const c = await lireJson("config.json", config);
  if (c && typeof c === "object") config = { ...config, ...c };
  if (/^https:\/\/(www\.)?youtube\.com\//.test(config.lien || "")) { $("lien-youtube").href = config.lien; $("lien-youtube").hidden = false; }
  chargerLecteur();
  window.addEventListener("online", chargerLecteur);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
async function partager() {
  const donnees = { title: "RTM en direct", text: "Regardez R.T.M Radio Télévision Moba en direct sur votre téléphone.", url: location.href.split("#")[0] };
  try {
    if (navigator.share) await navigator.share(donnees);
    else { await navigator.clipboard.writeText(donnees.url); $("partager").textContent = "Lien copié ✔"; }
  } catch (e) { /* partage annulé */ }
}
demarrer();
