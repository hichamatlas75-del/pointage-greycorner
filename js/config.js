/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 1 : Configuration Globale & Initialisation Firebase
 * =========================================================================
 */

const Config = Object.freeze({
  firebase: {
    apiKey: "AIzaSyC5al_6xWbJC8S0FAvaEnRmx9BvYtGgnAM",
    authDomain: "grey-corner-presence.firebaseapp.com",
    databaseURL: "https://grey-corner-presence-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "grey-corner-presence",
    storageBucket: "grey-corner-presence.firebasestorage.app",
    messagingSenderId: "730206093359",
    appId: "1:730206093359:web:59e3c145120807f29e46da"
  },
  geo: {
    cafeLat: 34.0343959,
    cafeLon: -5.0155941,
    maxRadiusMeters: 60, // Réduit de 200m à 60m (zone stricte Grey Corner et terrasse)
    maxAccuracyMeters: 40 // Seuil de précision max en mètres (rejette les approximations réseau)
  },
  endpoints: {
    urgentMsgSheet: "https://docs.google.com/spreadsheets/d/1boSKTYt4TQW00j02eBCWPzDHngFZmSqPGBvDL1wsq64/gviz/tq?tqx=out:json&sheet=Messages_Urgent",
    gasExecUrl: "https://script.google.com/macros/s/AKfycbyZFLn4Z8KHsB60caPMkdAFTXHkJcd_aP_oxP5cI_nDG7kZf5MzFm-U7vYPcNEUD4HY1Q/exec",
    // SÉCURITÉ : Le secret a été supprimé du code source client.
    // L'authentification se fait via le token ID Firebase de l'utilisateur connecté.
    // La fonction getAuthToken() récupère dynamiquement le token à transmettre au GAS.
    empNodeDefault: "pointage"
  },
  timeZone: "GMT",
  categories: ["service", "bar", "cuisine", "caisse", "menage", "securite", "economat"]
});

/**
 * Détection standardisée des arrêts maladie (M) validés par la direction RH
 * @param {Object} rec Enregistrement de présence ou de pointage
 * @returns {boolean} true si arrêt maladie validé
 */
function isExplicitMaladie(rec) {
  if (!rec || typeof rec !== "object") return false;
  if (rec.maladie === true || rec.maladie === "true" || rec.maladie === 1) return true;
  const statut = String(rec.statut || "").trim().toUpperCase();
  if (statut === "MALADIE" || statut === "ARRÊT MALADIE" || statut === "ARRET MALADIE" || statut === "M") return true;
  const type = String(rec.type || "").trim().toUpperCase();
  if (type === "MALADIE" || type === "M") return true;
  const motif = String(rec.motif || "").trim().toUpperCase();
  if (motif.startsWith("MALADIE") || motif.startsWith("ARRÊT MALADIE") || motif.startsWith("ARRET MALADIE")) return true;
  return false;
}

// Initialisation Firebase (Navigateur & Compatibilité Node.js pour tests)
let db = null;
let auth = null;

if (typeof firebase !== "undefined" && firebase.apps) {
  if (!firebase.apps.length) {
    firebase.initializeApp(Config.firebase);
  }
  db = firebase.database();
  auth = firebase.auth();
  if (auth && auth.setPersistence && firebase.auth.Auth) {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  }
}

// Export CommonJS pour les tests unitaires automatisés
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Config,
    isExplicitMaladie
  };
}
