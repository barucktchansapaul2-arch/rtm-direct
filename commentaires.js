// RTM en direct — réactions des spectateurs : j'aime, partage, commentaires filtrés.
import { ouvrirMagasin } from "./magasin.js";

const $ = (id) => document.getElementById(id);
const F = self.RTMFiltre;
let magasin = null;
let bloque = false;

function heure(ms) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}
function message(texte, type) {
  const z = $("com-message");
  z.textContent = texte || "";
  z.className = "com-message" + (type ? " " + type : "");
}

function afficher(liste) {
  const ol = $("com-liste");
  if (liste === null) { message("Connexion aux commentaires impossible pour l'instant.", "erreur"); return; }
  const enBas = ol.scrollHeight - ol.scrollTop - ol.clientHeight < 60;
  ol.textContent = "";                                   // tout est écrit en texte : aucun code ne peut s'exécuter
  if (!liste.length) {
    const li = document.createElement("li"); li.className = "vide"; li.textContent = "Soyez le premier à réagir !"; ol.appendChild(li);
  }
  for (const c of liste) {
    const li = document.createElement("li");
    if (c.uid === magasin.uid) li.className = "moi";
    const n = document.createElement("strong"); n.textContent = c.nom;
    const h = document.createElement("time"); h.textContent = heure(c.date);
    const t = document.createElement("p"); t.textContent = c.texte;
    li.append(n, h, t); ol.appendChild(li);
  }
  if (enBas) ol.scrollTop = ol.scrollHeight;
}

async function envoyer(e) {
  e.preventDefault();
  if (bloque) { message("Vous ne pouvez plus commenter : votre accès a été bloqué par la modération de RTM.", "erreur"); return; }
  const nom = $("com-nom").value.trim().replace(/\s+/g, " ");
  const texte = $("com-texte").value.trim().replace(/\s+/g, " ");
  const refus = F.verifier(texte, nom);
  if (refus) { message(refus, "erreur"); return; }
  $("com-envoyer").disabled = true;
  try {
    await magasin.envoyer(nom, texte);
    localStorage.setItem("rtm_nom", nom);
    $("com-texte").value = "";
    message("");
    $("com-liste").scrollTop = $("com-liste").scrollHeight;
  } catch (err) {
    if (err.code === "bloque") { bloque = true; message("Vous ne pouvez plus commenter : votre accès a été bloqué par la modération de RTM.", "erreur"); }
    else if (err.code === "vite") message("Doucement : attendez 10 secondes entre deux messages.", "erreur");
    else if (err.code === "refus") message("Message refusé (trop rapproché du précédent, ou mot non accepté).", "erreur");
    else message("Pas de connexion : le message n'est pas parti.", "erreur");
  }
  setTimeout(() => { $("com-envoyer").disabled = false; }, 3000);
}

async function demarrer() {
  try { magasin = await ouvrirMagasin(); } catch (e) { magasin = null; }
  if (!magasin) { $("reactions").hidden = true; return; }      // base pas encore branchée : rien n'est montré
  $("reactions").hidden = false;
  try { await magasin.connecter(); } catch (e) { message("Connexion aux commentaires impossible pour l'instant.", "erreur"); return; }
  $("com-nom").value = localStorage.getItem("rtm_nom") || "";
  $("com-texte").addEventListener("input", () => { $("com-compte").textContent = `${$("com-texte").value.length}/300`; });
  $("com-form").addEventListener("submit", envoyer);
  magasin.ecouterCommentaires(afficher);
  let aime = false;
  magasin.ecouterLikes((n, moi) => {
    aime = moi;
    $("aime-compte").textContent = n > 0 ? String(n) : "";
    $("aime").classList.toggle("actif", moi);
    $("aime").setAttribute("aria-pressed", String(moi));
  });
  $("aime").addEventListener("click", async () => {
    $("aime").disabled = true;
    try { await magasin.aimer(!aime); } catch (e) { message("Pas de connexion pour l'instant.", "erreur"); }
    $("aime").disabled = false;
  });
  bloque = await magasin.estBloque();
  if (bloque) { message("Vous ne pouvez plus commenter : votre accès a été bloqué par la modération de RTM.", "erreur"); $("com-form").classList.add("ferme"); }
}
demarrer();
