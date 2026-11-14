// RTM — page de modération : supprimer un commentaire, bloquer / débloquer un utilisateur.
import { ouvrirMagasin } from "./magasin.js";

const $ = (id) => document.getElementById(id);
let magasin = null;
let bloques = new Set();

function bouton(texte, classe, action) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = texte; b.className = classe;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try { await action(); $("msg-mod").textContent = ""; }
    catch (e) { $("msg-mod").textContent = "Action refusée : " + (e.message || e); $("msg-mod").className = "com-message erreur"; }
    b.disabled = false;
  });
  return b;
}

function afficherCommentaires(liste) {
  const ol = $("mod-liste");
  ol.textContent = "";
  if (!liste || !liste.length) { const li = document.createElement("li"); li.className = "vide"; li.textContent = "Aucun commentaire."; ol.appendChild(li); return; }
  for (const c of liste) {
    const li = document.createElement("li");
    const n = document.createElement("strong"); n.textContent = c.nom + (bloques.has(c.uid) ? " (bloqué)" : "");
    const h = document.createElement("time"); h.textContent = new Date(c.date).toLocaleString("fr-FR");
    const t = document.createElement("p"); t.textContent = c.texte;
    const suspect = self.RTMFiltre.motInterdit(c.texte);
    if (suspect) li.classList.add("suspect");
    const actions = document.createElement("div"); actions.className = "mod-actions";
    actions.append(
      bouton("Supprimer", "mod-suppr", () => magasin.supprimer(c.id)),
      bouton("Bloquer cette personne", "mod-bloquer", async () => { await magasin.bloquer(c.uid, c.nom); await magasin.supprimer(c.id); }));
    li.append(n, h, t, actions); ol.appendChild(li);
  }
  ol.scrollTop = ol.scrollHeight;
}

function afficherBloques(liste) {
  bloques = new Set(liste.map((b) => b.uid));
  const ol = $("mod-bloques");
  ol.textContent = "";
  if (!liste.length) { const li = document.createElement("li"); li.className = "vide"; li.textContent = "Personne n'est bloqué."; ol.appendChild(li); return; }
  for (const b of liste) {
    const li = document.createElement("li");
    const n = document.createElement("strong"); n.textContent = b.nom || "(sans nom)";
    const actions = document.createElement("div"); actions.className = "mod-actions";
    actions.append(bouton("Débloquer", "mod-suppr", () => magasin.debloquer(b.uid)));
    li.append(n, actions); ol.appendChild(li);
  }
}

async function demarrer() {
  magasin = await ouvrirMagasin();
  if (!magasin) {
    $("msg-connexion").textContent = "Les commentaires ne sont pas encore branchés (base Firebase à configurer dans la régie).";
    $("msg-connexion").className = "com-message erreur";
    return;
  }
  $("form-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("msg-connexion").textContent = "Connexion…"; $("msg-connexion").className = "com-message";
    try {
      await magasin.connexionAdmin($("email").value.trim(), $("mdp").value);
      $("connexion").hidden = true; $("panneau").hidden = false;
      magasin.ecouterBloques(afficherBloques);
      magasin.ecouterCommentaires(afficherCommentaires);
    } catch (err) {
      const code = err.code || "";
      $("msg-connexion").textContent = /invalid|wrong|not-found|credential/.test(code) ? "E-mail ou mot de passe incorrect." : (err.message || "Connexion impossible.");
      $("msg-connexion").className = "com-message erreur";
    }
  });
}
demarrer();
