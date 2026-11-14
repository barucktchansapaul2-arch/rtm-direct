// RTM en direct — où sont rangés les commentaires et les likes.
//   MagasinFirebase : la vraie base en ligne (Firestore), partagée par tous les spectateurs.
//   MagasinDemo     : démonstration sur ce seul appareil (adresse terminée par ?demo=1), pour essayer.
// Les deux ont les mêmes fonctions.

const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

export class MagasinDemo {
  constructor() {
    this.uid = localStorage.getItem("rtm_demo_uid") || ("demo-" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("rtm_demo_uid", this.uid);
    this.admin = false;
    this._abonnes = [];
  }
  _lire(cle, defaut) { try { return JSON.parse(localStorage.getItem("rtm_demo_" + cle)) ?? defaut; } catch (e) { return defaut; } }
  _ecrire(cle, v) { localStorage.setItem("rtm_demo_" + cle, JSON.stringify(v)); this._abonnes.forEach((f) => f()); }
  async connecter() { return this.uid; }
  async connexionAdmin(email, mdp) { if (!email || !mdp) throw new Error("E-mail et mot de passe obligatoires."); this.admin = true; return true; }
  ecouterCommentaires(cb) { const f = () => cb(this._lire("commentaires", []).slice(-80)); this._abonnes.push(f); f(); }
  ecouterLikes(cb) { const f = () => { const l = this._lire("likes", {}); cb(Object.keys(l).length, !!l[this.uid]); }; this._abonnes.push(f); f(); }
  async estBloque() { return !!this._lire("bloques", {})[this.uid]; }
  async envoyer(nom, texte) {
    if (await this.estBloque()) throw Object.assign(new Error("bloque"), { code: "bloque" });
    const dernier = this._lire("dernier_" + this.uid, 0);
    if (Date.now() - dernier < 10000) throw Object.assign(new Error("vite"), { code: "vite" });
    const liste = this._lire("commentaires", []);
    liste.push({ id: "c" + Date.now(), uid: this.uid, nom, texte, date: Date.now() });
    localStorage.setItem("rtm_demo_dernier_" + this.uid, String(Date.now()));
    this._ecrire("commentaires", liste);
  }
  async aimer(oui) { const l = this._lire("likes", {}); if (oui) l[this.uid] = 1; else delete l[this.uid]; this._ecrire("likes", l); }
  // modération
  async supprimer(id) { this._ecrire("commentaires", this._lire("commentaires", []).filter((c) => c.id !== id)); }
  async bloquer(uid, nom) { const b = this._lire("bloques", {}); b[uid] = { nom, date: Date.now() }; this._ecrire("bloques", b); }
  async debloquer(uid) { const b = this._lire("bloques", {}); delete b[uid]; this._ecrire("bloques", b); }
  ecouterBloques(cb) { const f = () => cb(Object.entries(this._lire("bloques", {})).map(([uid, v]) => ({ uid, ...v }))); this._abonnes.push(f); f(); }
}

export class MagasinFirebase {
  constructor(config) { this.config = config; this.uid = null; this.admin = false; }
  async _charger() {
    if (this.fs) return;
    const [app, auth, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`)]);
    this.a = auth; this.fs = fs;
    this.app = app.initializeApp(this.config);
    this.auth = auth.getAuth(this.app);
    this.db = fs.getFirestore(this.app);
  }
  async connecter() {                       // spectateur : identité anonyme, stable sur l'appareil
    await this._charger();
    if (!this.auth.currentUser) await this.a.signInAnonymously(this.auth);
    this.uid = this.auth.currentUser.uid;
    return this.uid;
  }
  async connexionAdmin(email, mdp) {        // modérateur : compte e-mail créé dans la console Firebase
    await this._charger();
    const r = await this.a.signInWithEmailAndPassword(this.auth, email, mdp);
    this.uid = r.user.uid;
    const d = await this.fs.getDoc(this.fs.doc(this.db, "admins", this.uid));
    this.admin = d.exists();
    if (!this.admin) throw new Error("Ce compte n'est pas modérateur (ajoutez son identifiant dans la collection « admins »).\nIdentifiant : " + this.uid);
    return true;
  }
  ecouterCommentaires(cb) {
    const { collection, query, orderBy, limitToLast, onSnapshot } = this.fs;
    return onSnapshot(query(collection(this.db, "commentaires"), orderBy("date"), limitToLast(80)), (s) => {
      cb(s.docs.map((d) => { const v = d.data(); return { id: d.id, uid: v.uid, nom: v.nom, texte: v.texte, date: v.date?.toMillis?.() || Date.now() }; }));
    }, () => cb(null));
  }
  ecouterLikes(cb) {
    const { collection, doc, onSnapshot, getCountFromServer } = this.fs;
    let moi = false;
    const compter = async () => {
      try { const n = await getCountFromServer(collection(this.db, "likes")); cb(n.data().count, moi); } catch (e) { /* hors ligne */ }
    };
    onSnapshot(doc(this.db, "likes", this.uid), (d) => { moi = d.exists(); compter(); });
    setInterval(compter, 20000);
  }
  async estBloque() {
    try { return (await this.fs.getDoc(this.fs.doc(this.db, "bloques", this.uid))).exists(); } catch (e) { return false; }
  }
  async envoyer(nom, texte) {
    const { writeBatch, doc, collection, serverTimestamp } = this.fs;
    const lot = writeBatch(this.db);
    lot.set(doc(collection(this.db, "commentaires")), { uid: this.uid, nom, texte, date: serverTimestamp() });
    lot.set(doc(this.db, "utilisateurs", this.uid), { dernier: serverTimestamp() });   // anti-inondation (règles)
    try { await lot.commit(); } catch (e) {
      if (await this.estBloque()) throw Object.assign(new Error("bloque"), { code: "bloque" });
      throw Object.assign(new Error("refus"), { code: e.code === "permission-denied" ? "refus" : "reseau" });
    }
  }
  async aimer(oui) {
    const { doc, setDoc, deleteDoc, serverTimestamp } = this.fs;
    const d = doc(this.db, "likes", this.uid);
    if (oui) await setDoc(d, { date: serverTimestamp() }); else await deleteDoc(d);
  }
  async supprimer(id) { await this.fs.deleteDoc(this.fs.doc(this.db, "commentaires", id)); }
  async bloquer(uid, nom) {
    await this.fs.setDoc(this.fs.doc(this.db, "bloques", uid), { nom: String(nom || "").slice(0, 30), date: this.fs.serverTimestamp(), par: this.uid });
  }
  async debloquer(uid) { await this.fs.deleteDoc(this.fs.doc(this.db, "bloques", uid)); }
  ecouterBloques(cb) {
    return this.fs.onSnapshot(this.fs.collection(this.db, "bloques"), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
  }
}

export async function ouvrirMagasin() {
  const demo = new URLSearchParams(location.search).has("demo");
  if (demo) return new MagasinDemo();
  let config = null;
  try { const r = await fetch("config.json?t=" + Math.floor(Date.now() / 300000), { cache: "no-store" }); config = (await r.json()).firebase; } catch (e) { /* hors ligne */ }
  if (!config || !config.apiKey || !config.projectId) return null;      // pas encore branché
  return new MagasinFirebase(config);
}
