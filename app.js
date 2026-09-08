/**
 * =========================================================================
 * GREY CORNER • APPLICATION DE POINTAGE MODULAIRE
 * =========================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION GLOBALE
// ─────────────────────────────────────────────────────────────────────────
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
    maxRadiusMeters: 200
  },
  endpoints: {
    urgentMsgSheet: "https://docs.google.com/spreadsheets/d/1boSKTYt4TQW00j02eBCWPzDHngFZmSqPGBvDL1wsq64/gviz/tq?tqx=out:json&sheet=Messages_Urgent",
    gasExecUrl: "https://script.google.com/macros/s/AKfycbyZFLn4Z8KHsB60caPMkdAFTXHkJcd_aP_oxP5cI_nDG7kZf5MzFm-U7vYPcNEUD4HY1Q/exec",
    secret: "greycorner2026",
    empNodeDefault: "pointage"
  },
  timeZone: "Africa/Casablanca",
  categories: ["service", "bar", "cuisine", "caisse", "menage", "securite", "economat"]
});

// Initialisation Firebase
if (!firebase.apps.length) firebase.initializeApp(Config.firebase);
const db = firebase.database();
const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

// ─────────────────────────────────────────────────────────────────────────
// 2. TIME SERVICE (Anti-fraude Horodatage Serveur)
// ─────────────────────────────────────────────────────────────────────────
const TimeService = (() => {
  let serverOffset = 0;

  // Écoute continue du décalage d'horloge serveur Firebase
  db.ref(".info/serverTimeOffset").on("value", snap => {
    serverOffset = Number(snap.val() || 0);
  });

  function getTrustedDate() {
    return new Date(Date.now() + serverOffset);
  }

  function currentDateStr() {
    return new Intl.DateTimeFormat("fr-CA", {
      timeZone: Config.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(getTrustedDate());
  }

  function currentTimeHHMM() {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: Config.timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(getTrustedDate());
  }

  function timeToMin(t) {
    if (!t || typeof t !== "string" || !t.includes(":")) return null;
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  return {
    getTrustedDate,
    currentDateStr,
    currentTimeHHMM,
    timeToMin
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 3. SECURITY & STORAGE SERVICE (PIN & Clés)
// ─────────────────────────────────────────────────────────────────────────
const SecurityService = (() => {
  function normalizeText(x) {
    return String(x || "").trim().toUpperCase().replace(/\s+/g, " ");
  }

  function normalizeRole(x) {
    const r = String(x || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return Config.categories.includes(r) ? r : (r || "service");
  }

  function keyStaff(name) {
    return String(name || "").trim().replace(/\s+/g, "_").toUpperCase();
  }

  // Hashage simple SHA-256 pour le PIN
  async function hashPin(pin) {
    if (!pin) return "";
    try {
      const enc = new TextEncoder().encode(pin + "_gc_salt_2026");
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      return "plain_" + pin;
    }
  }

  async function verifyPin(enteredPin, storedHash) {
    if (!storedHash) return true;
    const hashed = await hashPin(enteredPin);
    return hashed === storedHash || storedHash === enteredPin || storedHash === ("plain_" + enteredPin);
  }

  return {
    normalizeText,
    normalizeRole,
    keyStaff,
    hashPin,
    verifyPin
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 3b. STAFF PHOTO SERVICE (Cartographie & Résolution Photos Équipe)
// ─────────────────────────────────────────────────────────────────────────
const StaffPhotoService = (() => {
  // Liste exhaustive des correspondances directes et variantes orthographiques
  const PHOTO_MAP = {
    // Cuisine
    "BELQASSE_KHAOULA": "images/BELQASIM_KHAOULA.jpg",
    "BELQASIM_KHAOULA": "images/BELQASIM_KHAOULA.jpg",
    "BELQASSE": "images/BELQASIM_KHAOULA.jpg",
    "BELQASIM": "images/BELQASIM_KHAOULA.jpg",
    "BOUCHNAK_NAOUAL": "images/BOUCHNAK_NAOUAL.jpg",
    "BOUCHNAK": "images/BOUCHNAK_NAOUAL.jpg",
    "BOURAHMA_ANAS": "images/BOURAHMA_ANAS.jpg",
    "BOURAHMA": "images/BOURAHMA_ANAS.jpg",
    "IDRISSI_SAAD": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "IDRISSI_OUDGHRI_SAAD": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "IDRISSI_OUDGHRISSAAD": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "IDRISSI": "images/IDRISSI_OUDGHRI_SAAD.jpg",
    "LEMSSIEH_JAWAD": "images/LAMSSIAH_JAOUAD.jpg",
    "LAMSSIAH_JAOUAD": "images/LAMSSIAH_JAOUAD.jpg",
    "LEMSSIEH": "images/LAMSSIAH_JAOUAD.jpg",
    "LAMSSIAH": "images/LAMSSIAH_JAOUAD.jpg",
    "MAJDOUB_JIHANE": "images/MAJDOUB_JIHANE.jpg",
    "MAJDOUB": "images/MAJDOUB_JIHANE.jpg",
    "MOUJAHID_IMANE": "images/MOUJAHID_IMANE.jpg",
    "MOUJAHID": "images/MOUJAHID_IMANE.jpg",
    "ZAIR_FATIMA": "images/ZAIR_FATIMA.jpg",
    "ZAIR": "images/ZAIR_FATIMA.jpg",

    // Service
    "ALAOUI_LAZIZ": "images/HAMID_ALAOUI_ABDELAZIZ.jpg",
    "HAMID_ALAOUI_ABDELAZIZ": "images/HAMID_ALAOUI_ABDELAZIZ.jpg",
    "ALAOUI": "images/HAMID_ALAOUI_ABDELAZIZ.jpg",
    "HATTAF_MOHAMED": "images/HATTAF_MOHAMMED.jpg",
    "HATTAF_MOHAMMED": "images/HATTAF_MOHAMMED.jpg",
    "HATIAF_MOHAMMED": "images/HATTAF_MOHAMMED.jpg",
    "HATTAF": "images/HATTAF_MOHAMMED.jpg",
    "HIDARA_YOUSSEF": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "HIDARA_LACHKAR_YOUSSEF": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "HIDARA-LACHKAR_YOUSSEF": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "HIDARA": "images/HIDARA-LACHKAR_YOUSSEF.jpg",
    "KAFOUNI_ZAKARIAE": "images/KAFOUNI_ZAKARIAE.jpg",
    "KAFQUNI_ZAKARIAE": "images/KAFOUNI_ZAKARIAE.jpg",
    "KAFOUNI": "images/KAFOUNI_ZAKARIAE.jpg",
    "KTAMI_EL_MOKHTAR": "images/Mokhtar.jpg",
    "EL_MOKHTAR": "images/Mokhtar.jpg",
    "MOKHTAR": "images/Mokhtar.jpg",
    "KTAMI": "images/Mokhtar.jpg",
    "MOHSINE_YOUNESS": "images/MOHSSINE_YOUNESS.jpg",
    "MOHSSINE_YOUNESS": "images/MOHSSINE_YOUNESS.jpg",
    "MOHSINE": "images/MOHSSINE_YOUNESS.jpg",
    "MOHSSINE": "images/MOHSSINE_YOUNESS.jpg",

    // Caisse
    "BENKHADA_ABDESLAM": "images/BENKHADA_ABDESSLAM.jpg",
    "BENKHADA_ABDESSLAM": "images/BENKHADA_ABDESSLAM.jpg",
    "BENKHADA_ABDELSSAM": "images/BENKHADA_ABDESSLAM.jpg",
    "BENKHADA": "images/BENKHADA_ABDESSLAM.jpg",
    "ENNHAILI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN_NHAILI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN_NHAJLI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN-NHAILI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "EN-NHAJLI_SOUMIA": "images/EN-NHAILI_SOUMIA.jpg",
    "NHAILI": "images/EN-NHAILI_SOUMIA.jpg",
    "NHAJLI": "images/EN-NHAILI_SOUMIA.jpg",
    "SALIL_HOUDA": "images/SALIL_HOUDA.jpg",
    "SALIH_HOUDA": "images/SALIL_HOUDA.jpg",
    "SALIL": "images/SALIL_HOUDA.jpg",
    "SALIH": "images/SALIL_HOUDA.jpg",

    // Bar / Autres
    "EL_KOBBI_MOSTAFA": "images/EL_KOBBI_MOSTAFA.jpg",
    "ELKOBBI_MOSTAFA": "images/EL_KOBBI_MOSTAFA.jpg",
    "KOBBI": "images/EL_KOBBI_MOSTAFA.jpg",
    "EL_MOBARAKI_MOHAMED": "images/EL_MOBARAKI_MOHAMED.jpg",
    "ELMOBARAKI_MOHAMED": "images/EL_MOBARAKI_MOHAMED.jpg",
    "MOBARAKI": "images/EL_MOBARAKI_MOHAMED.jpg",
    "ELGORRAMY_SOUAD": "images/ELGORRAMY_SOUAD.jpg",
    "EL_GORRAMY_SOUAD": "images/ELGORRAMY_SOUAD.jpg",
    "GORRAMY": "images/ELGORRAMY_SOUAD.jpg",
    "CHKAIRI_YOUSSEF": "images/CHKAIRI_YOUSSEF.jpg",
    "CH_KAIRI_YOUSSEF": "images/CHKAIRI_YOUSSEF.jpg",
    "CHKAIRI": "images/CHKAIRI_YOUSSEF.jpg",
    "JIRA_MOHAMED": "images/JIRA_MOHAMED.jpg",
    "JRA_MOHAMED": "images/JIRA_MOHAMED.jpg",
    "JIRA": "images/JIRA_MOHAMED.jpg",
    "JRA": "images/JIRA_MOHAMED.jpg",
    "KHALOUQ_RACHID": "images/KHALOUQ_RACHID.jpg",
    "KHALOUQ": "images/KHALOUQ_RACHID.jpg",
    "QUASSIR_HICHAM": "images/QUASSIR_HICHAM.jpg",
    "OUASSIR_HICHAM": "images/QUASSIR_HICHAM.jpg",
    "QUASSIR": "images/QUASSIR_HICHAM.jpg",
    "OUASSIR": "images/QUASSIR_HICHAM.jpg",
    "SBAI_HAKIMA": "images/SBAI_HAKIMA.jpg",
    "SBAI": "images/SBAI_HAKIMA.jpg",
    "TOUATI_OMAR": "images/TOUATI_OMAR.jpg",
    "TOUATI": "images/TOUATI_OMAR.jpg",
    "WALID": "images/WALID.jpg",
    "BAJJOU": "images/BAJJOU.jpeg",
    "FOUZIA": "images/FOUZIA.jpg",
    "FOUZIA6ZHAR": "images/FOUZIA6ZHAR.jpg",
    "FOUZIA_ZHAR": "images/FOUZIA6ZHAR.jpg",
    "FOUZIA_EZHAR": "images/FOUZIA6ZHAR.jpg"
  };

  function normalize(str) {
    return String(str || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  // Normalisation phonétique tolérante aux doubles consonnes et variations
  function simplify(str) {
    return normalize(str)
      .replace(/SS/g, "S")
      .replace(/MM/g, "M")
      .replace(/TT/g, "T")
      .replace(/LL/g, "L")
      .replace(/BB/g, "B")
      .replace(/DD/g, "D")
      .replace(/FF/g, "F")
      .replace(/OU/g, "U")
      .replace(/_/g, "");
  }

  function getInitials(name) {
    if (!name) return "GC";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getPhotoUrl(name) {
    if (!name) return null;
    const clean = normalize(name);
    
    // 1. Correspondance exacte dans PHOTO_MAP
    if (PHOTO_MAP[clean]) return PHOTO_MAP[clean];

    // 2. Correspondance simplifiée
    const simpleClean = simplify(clean);
    for (const [key, url] of Object.entries(PHOTO_MAP)) {
      if (simplify(key) === simpleClean) return url;
    }

    // 3. Inclusion sous-chaîne directe
    for (const [key, url] of Object.entries(PHOTO_MAP)) {
      if (clean.includes(key) || key.includes(clean)) return url;
    }

    // 4. Correspondance par mot clé principal (longueur >= 4)
    const words = clean.split("_").filter(w => w.length >= 4);
    for (const w of words) {
      if (PHOTO_MAP[w]) return PHOTO_MAP[w];
      const sw = simplify(w);
      for (const [key, url] of Object.entries(PHOTO_MAP)) {
        if (simplify(key).includes(sw) || sw.includes(simplify(key))) {
          return url;
        }
      }
    }

    return null;
  }

  return { getPhotoUrl, getInitials, normalize };
})();

const StorageService = (() => {
  const KEYS = {
    staffName: "gc_staff_name",
    devicePin: "gc_device_pin",
    punchDone: (d, k) => `gc_punch_done__${d}__${k}`,
    punchTime: (d, k) => `gc_punch_time__${d}__${k}`
  };

  return {
    getSelectedStaff: () => localStorage.getItem(KEYS.staffName) || null,
    setSelectedStaff: (name) => localStorage.setItem(KEYS.staffName, name),
    clearSelectedStaff: () => localStorage.removeItem(KEYS.staffName),

    getDevicePinHash: () => localStorage.getItem(KEYS.devicePin) || "",
    setDevicePinHash: (hash) => localStorage.setItem(KEYS.devicePin, hash),
    hasDevicePin: () => !!localStorage.getItem(KEYS.devicePin),

    isPunchedLocal: (d, k) => localStorage.getItem(KEYS.punchDone(d, k)) === "1",
    getPunchedTimeLocal: (d, k) => localStorage.getItem(KEYS.punchTime(d, k)) || "",
    setPunchedLocal: (d, k, hhmm) => {
      localStorage.setItem(KEYS.punchDone(d, k), "1");
      if (hhmm) localStorage.setItem(KEYS.punchTime(d, k), hhmm);
    },

    resetAll: () => localStorage.clear()
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 4. UI SERVICE & TOAST
// ─────────────────────────────────────────────────────────────────────────
const UIService = (() => {
  let toastTimer = null;

  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = "none"; }, 2600);
  }

  function updateGpsDot(state) {
    const dot = document.getElementById("gpsDot");
    if (dot) dot.className = "gps-dot " + state;
  }

  function setPunchButtonEnabled(enabled) {
    const btn = document.getElementById("btn");
    const wrap = document.getElementById("btnMainWrap");
    if (!btn || !wrap) return;
    btn.disabled = !enabled;
    if (enabled) wrap.classList.add("gps-ready");
    else wrap.classList.remove("gps-ready");
  }

  function showRetryGPS(show) {
    const b = document.getElementById("btnRetryGPS");
    if (b) b.style.display = show ? "block" : "none";
  }

  function updateGpsUI({ text, textColor, dotState, canPunch, showRetry }) {
    const status = document.getElementById("status");
    if (status) {
      status.textContent = text || "";
      status.style.color = textColor || "var(--muted)";
    }
    updateGpsDot(dotState || "searching");
    setPunchButtonEnabled(!!canPunch);
    showRetryGPS(!!showRetry);
  }

  function renderPointedBox(hhmm, dStr) {
    const zone = document.getElementById("pointage-zone");
    if (!zone) return;
    const status = document.getElementById("status");
    if (status) {
      status.textContent = "Pointé ✓";
      status.style.color = "var(--emerald-neon)";
    }
    updateGpsDot("ok");

    const wrap = document.getElementById("btnMainWrap");
    if (wrap) wrap.style.display = "none";
    showRetryGPS(false);

    let box = document.getElementById("pointedBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "pointedBox";
      box.className = "pointed-box";
      zone.appendChild(box);
    }
    box.style.display = "block";
    box.innerHTML = `
      <div class="pointed-check">✓</div>
      <div class="label-caps mb-1" style="color:var(--emerald-neon);letter-spacing:.15em">Présence enregistrée</div>
      <div class="pointed-time">${hhmm || "—"}</div>
      <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${dStr}</div>
    `;
    setPunchButtonEnabled(false);
  }

  function initNetworkListener() {
    const bar = document.getElementById("offlineBar");
    function updateNetworkStatus() {
      if (!bar) return;
      if (navigator.onLine) bar.style.display = "none";
      else bar.style.display = "block";
    }
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    updateNetworkStatus();
  }

  return {
    toast,
    updateGpsDot,
    setPunchButtonEnabled,
    showRetryGPS,
    updateGpsUI,
    renderPointedBox,
    initNetworkListener
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 5. GPS SERVICE (Géolocalisation & Périmètre)
// ─────────────────────────────────────────────────────────────────────────
const GpsService = (() => {
  let state = "idle";
  let lastCheckedKey = "";
  let lastPosition = null;

  function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function checkGPS(force = false) {
    const selected = StorageService.getSelectedStaff();
    if (!selected) return;

    const staffKey = SecurityService.keyStaff(selected);
    const dStr = TimeService.currentDateStr();

    if (StorageService.isPunchedLocal(dStr, staffKey)) {
      UIService.setPunchButtonEnabled(false);
      UIService.showRetryGPS(false);
      return;
    }

    const lockKey = `${dStr}__${staffKey}`;
    if (!force && lastCheckedKey === lockKey && (state === "ok" || state === "bad" || state === "denied" || state === "error")) {
      return;
    }

    lastCheckedKey = lockKey;
    state = "searching";
    UIService.updateGpsUI({
      text: "Recherche GPS…",
      textColor: "var(--muted)",
      dotState: "searching",
      canPunch: false,
      showRetry: false
    });

    if (!navigator.geolocation) {
      state = "error";
      UIService.updateGpsUI({
        text: "GPS non supporté",
        textColor: "var(--red)",
        dotState: "error",
        canPunch: false,
        showRetry: false
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        lastPosition = { lat, lon, accuracy };

        const distance = getDistanceMeters(Config.geo.cafeLat, Config.geo.cafeLon, lat, lon);

        if (distance <= Config.geo.maxRadiusMeters) {
          state = "ok";
          UIService.updateGpsUI({
            text: "Position validée ✓",
            textColor: "var(--green)",
            dotState: "ok",
            canPunch: true,
            showRetry: false
          });
        } else {
          state = "bad";
          UIService.updateGpsUI({
            text: `Hors zone · ${Math.round(distance)}m`,
            textColor: "var(--red)",
            dotState: "bad",
            canPunch: false,
            showRetry: true
          });
        }
      },
      err => {
        const code = err?.code;
        state = (code === 1) ? "denied" : "error";
        const text = (code === 1) ? "GPS refusé — autorisez la position" : (code === 3) ? "GPS trop lent" : "Erreur signal GPS";
        UIService.updateGpsUI({
          text,
          textColor: "var(--red)",
          dotState: state,
          canPunch: false,
          showRetry: true
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  return {
    checkGPS,
    getState: () => state,
    getLastPosition: () => lastPosition
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 6. TEAM & ROLES SERVICE
// ─────────────────────────────────────────────────────────────────────────
const TeamService = (() => {
  let equipeList = [];
  let equipeMap = new Map();
  let listenerAttached = false;

  function normalizeSnapshot(val) {
    if (!val) return [];
    const arr = Array.isArray(val)
      ? val.filter(Boolean)
      : Object.keys(val).sort((a, b) => Number(a) - Number(b)).map(k => val[k]).filter(Boolean);

    const out = [], seen = new Set();
    for (const x of arr) {
      const nom = SecurityService.normalizeText(x.nom);
      const prenom = SecurityService.normalizeText(x.prenom);
      const poste = SecurityService.normalizeRole(x.poste);
      if (!nom || !prenom) continue;
      const full = `${nom} ${prenom}`;
      if (seen.has(full)) continue;
      seen.add(full);
      out.push({ n: full, t: poste });
    }
    return out;
  }

  function isSecuriteRole(empKey) {
    if (!empKey) return false;
    const e = equipeMap.get(empKey);
    if (e && (e.t === "securite" || e.t === "sécurité")) return true;
    const selected = StorageService.getSelectedStaff();
    if (selected) {
      const s = equipeList.find(x => SecurityService.keyStaff(x.n) === empKey || x.n === selected);
      if (s && (s.t === "securite" || s.t === "sécurité")) return true;
    }
    return false;
  }

  function attachListener(onUpdate) {
    if (listenerAttached) return;
    listenerAttached = true;
    db.ref("settings/equipe").on("value", snap => {
      equipeList = normalizeSnapshot(snap.val());
      equipeMap = new Map();
      equipeList.forEach(e => equipeMap.set(SecurityService.keyStaff(e.n), e));
      if (onUpdate) onUpdate(equipeList);
    });
  }

  return {
    getEquipeList: () => equipeList,
    isSecuriteRole,
    attachListener
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 7. HISTORIQUE MENSUEL & 7 JOURS SERVICE
// ─────────────────────────────────────────────────────────────────────────
const HistoryService = (() => {
  const JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const MOIS_FR  = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  const MOIS_LONGS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  let mode = "month"; // "7d" ou "month"
  let currentDate = new Date();

  function calculateLateMinutes(hP, hA, empKey) {
    if (empKey === "BOUCHNAK_NAOUAL") return 0;
    if (!hA) return 0;
    let scheduled = hP;
    if (!scheduled && TeamService.isSecuriteRole(empKey)) {
      scheduled = "09:00";
    }
    if (!scheduled) return 0;
    const p = TimeService.timeToMin(scheduled);
    const a = TimeService.timeToMin(hA);
    if (p === null || a === null) return 0;
    return Math.max(0, a - p);
  }

  function getLast7Dates() {
    const dates = [];
    const todayStr = TimeService.currentDateStr();
    const [y, m, d] = todayStr.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    for (let i = 0; i < 7; i++) {
      const dd = new Date(base);
      dd.setDate(dd.getDate() - i);
      const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
      dates.push({ iso, dd });
    }
    return dates;
  }

  function getMonthDates(year, month) {
    const dates = [];
    const todayStr = TimeService.currentDateStr();
    const [todayY, todayM, todayD] = todayStr.split("-").map(Number);
    const isCurrentMonth = (year === todayY && month === (todayM - 1));

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const maxDay = isCurrentMonth ? Math.min(todayD, daysInMonth) : daysInMonth;

    for (let day = maxDay; day >= 1; day--) {
      const dd = new Date(year, month, day);
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      dates.push({ iso, dd });
    }
    return dates;
  }

  async function loadHistorique(staffKey) {
    if (!staffKey) {
      const sel = StorageService.getSelectedStaff();
      if (sel) staffKey = SecurityService.keyStaff(sel);
    }
    if (!staffKey) return;

    const wrap = document.getElementById("histoWrap");
    const list = document.getElementById("histoList");
    const loading = document.getElementById("histoLoading");
    const label = document.getElementById("histoMonthLabel");
    const btnNext = document.getElementById("btnHistoNext");
    const btnPrev = document.getElementById("btnHistoPrev");
    if (!wrap || !list) return;

    wrap.style.display = "block";
    if (loading) loading.textContent = "…";

    const todayStr = TimeService.currentDateStr();
    const [todayY, todayM, todayD] = todayStr.split("-").map(Number);
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Titre
    if (label) {
      label.textContent = (mode === "7d") ? "7 derniers jours" : `${MOIS_LONGS_FR[currentMonth]} ${currentYear}`;
    }

    const isLatestMonth = (currentYear > todayY) || (currentYear === todayY && currentMonth >= (todayM - 1));
    if (btnNext) btnNext.disabled = (mode === "7d") || isLatestMonth;
    if (btnPrev) btnPrev.disabled = (mode === "7d");

    let dates = [];
    let minDate = "";
    let maxDate = "";

    if (mode === "7d") {
      dates = getLast7Dates();
      minDate = dates[dates.length - 1].iso;
      maxDate = dates[0].iso;
    } else {
      dates = getMonthDates(currentYear, currentMonth);
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      minDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
      maxDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    }

    const isSec = TeamService.isSecuriteRole(staffKey);
    let punchesMap = {};
    let presencesMap = {};

    try {
      const [punchRes, presRes] = await Promise.allSettled([
        db.ref("punches").orderByKey().startAt(minDate).endAt(maxDate).once("value"),
        db.ref("presences").orderByKey().startAt(minDate).endAt(maxDate).once("value")
      ]);
      if (punchRes.status === "fulfilled" && punchRes.value) punchesMap = punchRes.value.val() || {};
      if (presRes.status === "fulfilled" && presRes.value) presencesMap = presRes.value.val() || {};
    } catch (e) {
      const snaps = await Promise.all(
        dates.map(async ({ iso }) => {
          const [pu, pr] = await Promise.all([
            db.ref(`punches/${iso}/${staffKey}`).once("value").then(s => s.val()).catch(() => null),
            db.ref(`presences/${iso}/${staffKey}`).once("value").then(s => s.val()).catch(() => null)
          ]);
          return { iso, pu, pr };
        })
      );
      snaps.forEach(({ iso, pu, pr }) => {
        if (pu) punchesMap[iso] = { [staffKey]: pu };
        if (pr) presencesMap[iso] = { [staffKey]: pr };
      });
    }

    if (loading) loading.textContent = "";
    list.innerHTML = "";

    let countPresent = 0;
    let countLate = 0;
    let totalLateMin = 0;
    let countOff = 0;

    dates.forEach(({ iso, dd: dt }) => {
      const pu = punchesMap[iso]?.[staffKey] || null;
      const pr = presencesMap[iso]?.[staffKey] || null;

      const [, mm, dd] = iso.split("-").map(Number);
      const isMonday = (dt.getDay() === 1);

      const hA = pu?.hA || pr?.hA || (StorageService.isPunchedLocal(iso, staffKey) ? StorageService.getPunchedTimeLocal(iso, staffKey) : "");
      const hP = pr?.hP || pu?.hP || (isSec ? "09:00" : "");
      const isOff = pr?.off === true || (isSec && isMonday && !hA);

      let lateMin = 0;
      if (pu && typeof pu.retardMin === "number" && pu.retardMin > 0) {
        lateMin = pu.retardMin;
      } else if (pr && typeof pr.retardMin === "number" && pr.retardMin > 0) {
        lateMin = pr.retardMin;
      } else if (hA && (hP || isSec)) {
        lateMin = calculateLateMinutes(hP || "09:00", hA, staffKey);
      }

      const isLate = (lateMin > 0);
      const isToday = (iso === todayStr);

      if (hA) {
        countPresent++;
        if (isLate) {
          countLate++;
          totalLateMin += lateMin;
        }
      } else if (isOff) {
        countOff++;
      }

      const jour = JOURS_FR[dt.getDay()];
      const dateFormatted = `${String(dd).padStart(2, "0")} ${MOIS_FR[mm - 1]}`;

      const row = document.createElement("div");
      row.className = "histo-row" + (isToday ? " histo-today" : "");

      let statusHTML = "";
      if (hA) {
        if (isLate) {
          statusHTML = `
            <div class="histo-status histo-retard">
              <span class="histo-dot" style="background:var(--red);box-shadow:0 0 6px rgba(239,68,68,.7)"></span>
              <span style="font-weight:900;color:#fff">${hA}</span>
              <span class="histo-retard-badge">+${lateMin} min</span>
            </div>`;
        } else {
          statusHTML = `
            <div class="histo-status histo-present">
              <span class="histo-dot" style="background:var(--green);box-shadow:0 0 5px rgba(16,185,129,.6)"></span>
              <span style="font-weight:900">${hA}</span>
              ${(hP || isSec) ? `<span class="histo-ontime-badge">À l'heure</span>` : ""}
            </div>`;
        }
      } else if (isOff) {
        statusHTML = `
          <div class="histo-status">
            <span class="histo-dot" style="background:rgba(99,102,241,.6)"></span>
            <span class="histo-off-badge" style="border-color:rgba(99,102,241,.3);color:#a5b4fc">${isSec && isMonday ? "OFF (Lundi)" : "OFF"}</span>
          </div>`;
      } else {
        statusHTML = `
          <div class="histo-status histo-absent">
            <span class="histo-dot" style="background:rgba(232,233,239,.18)"></span>
            ${isToday ? "Pas encore pointé" : "Absent"}
          </div>`;
      }

      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <div class="histo-day">${jour}</div>
          <div class="histo-date">${dateFormatted}${isToday ? '&nbsp;<span style="color:var(--gold);font-size:9px">auj.</span>' : ""}</div>
        </div>
        ${statusHTML}
      `;
      list.appendChild(row);
    });

    // Mise à jour des KPIs
    const elPresent = document.getElementById("kpiPresentCount");
    const elLate    = document.getElementById("kpiLateCount");
    const elTotalMin= document.getElementById("kpiTotalLateMin");
    const elOff     = document.getElementById("kpiOffCount");
    if (elPresent) elPresent.textContent = countPresent;
    if (elLate) elLate.textContent = countLate;
    if (elTotalMin) elTotalMin.textContent = totalLateMin > 0 ? `+${totalLateMin}m` : "0m";
    if (elOff) elOff.textContent = countOff;
  }

  function initControls() {
    const btnPrev = document.getElementById("btnHistoPrev");
    const btnNext = document.getElementById("btnHistoNext");
    const tab7d   = document.getElementById("btnTab7d");
    const tabMonth= document.getElementById("btnTabMonth");

    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (mode === "7d") return;
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadHistorique();
      });
    }

    if (btnNext) {
      btnNext.addEventListener("click", () => {
        if (mode === "7d") return;
        const todayStr = TimeService.currentDateStr();
        const [todayY, todayM] = todayStr.split("-").map(Number);
        const nextDate = new Date(currentDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        if (nextDate.getFullYear() > todayY || (nextDate.getFullYear() === todayY && nextDate.getMonth() >= todayM)) {
          return;
        }
        currentDate = nextDate;
        loadHistorique();
      });
    }

    if (tab7d) {
      tab7d.addEventListener("click", () => {
        if (mode === "7d") return;
        mode = "7d";
        tab7d.classList.add("active");
        if (tabMonth) tabMonth.classList.remove("active");
        loadHistorique();
      });
    }

    if (tabMonth) {
      tabMonth.addEventListener("click", () => {
        if (mode === "month") return;
        mode = "month";
        tabMonth.classList.add("active");
        if (tab7d) tab7d.classList.remove("active");
        loadHistorique();
      });
    }
  }

  return {
    loadHistorique,
    calculateLateMinutes,
    initControls
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 8. PUNCH & POINTAGE CONTROLLER
// ─────────────────────────────────────────────────────────────────────────
const PunchController = (() => {
  async function sendToSheetBackground({ date, empNode, empKey, hA, timestamp }) {
    const params = new URLSearchParams({
      action: "punch",
      secret: Config.endpoints.secret,
      date,
      empNode,
      empKey,
      hA,
      status: "punch",
      timestamp: String(timestamp)
    });
    const url = Config.endpoints.gasExecUrl + "?" + params.toString();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      await fetch(url, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
    } catch (e) {}
  }

  async function handlePunch() {
    const selected = StorageService.getSelectedStaff();
    if (!selected) return;

    const staffKey = SecurityService.keyStaff(selected);
    const dStr = TimeService.currentDateStr();
    const hA = TimeService.currentTimeHHMM();
    const ts = TimeService.getTrustedDate().getTime();

    UIService.setPunchButtonEnabled(false);

    if (StorageService.isPunchedLocal(dStr, staffKey)) {
      UIService.toast("Déjà pointé aujourd'hui ✅");
      UIService.renderPointedBox(StorageService.getPunchedTimeLocal(dStr, staffKey), dStr);
      return;
    }

    if (GpsService.getState() !== "ok") {
      UIService.toast("GPS non validé ❌");
      GpsService.checkGPS(true);
      return;
    }

    let retard = false;
    let retardMin = 0;

    try {
      const presSnap = await db.ref(`presences/${dStr}/${staffKey}`).once("value");
      const presVal = presSnap.val();
      const effectiveHP = presVal?.hP || (TeamService.isSecuriteRole(staffKey) ? "09:00" : "");
      if (effectiveHP) {
        const lm = HistoryService.calculateLateMinutes(effectiveHP, hA, staffKey);
        if (lm > 0) {
          retard = true;
          retardMin = lm;
        }
      }
    } catch (e) {}

    const coords = GpsService.getLastPosition();
    const payload = {
      empKey: staffKey,
      hA,
      retard,
      retardMin,
      timestamp: ts,
      coords: coords ? { lat: coords.lat, lon: coords.lon, acc: Math.round(coords.accuracy || 0) } : null
    };

    try {
      await db.ref(`punches/${dStr}/${staffKey}`).set(payload);
    } catch (e) {
      UIService.toast("Erreur de connexion Firebase ❌");
      UIService.setPunchButtonEnabled(GpsService.getState() === "ok");
      UIService.showRetryGPS(GpsService.getState() !== "ok");
      return;
    }

    StorageService.setPunchedLocal(dStr, staffKey, hA);
    UIService.toast(retard ? `Pointage validé (Retard +${retardMin} min) ⚠️` : "Pointage validé avec succès ✅");
    UIService.renderPointedBox(hA, dStr);
    HistoryService.loadHistorique(staffKey);

    sendToSheetBackground({
      date: dStr,
      empNode: selected || Config.endpoints.empNodeDefault,
      empKey: staffKey,
      hA,
      timestamp: ts
    });
  }

  function init() {
    const btn = document.getElementById("btn");
    if (btn) btn.addEventListener("click", handlePunch);

    const btnRetry = document.getElementById("btnRetryGPS");
    if (btnRetry) btnRetry.addEventListener("click", () => GpsService.checkGPS(true));
  }

  return { init };
})();

// ─────────────────────────────────────────────────────────────────────────
// 9. ADMIN & BROADCAST CONTROLLER
// ─────────────────────────────────────────────────────────────────────────
const AdminController = (() => {
  let currentRole = null;

  function openAdmin(silent = false) {
    if (currentRole !== "gerant") return;
    document.getElementById("adminWrap").style.display = "flex";
    document.getElementById("selection").classList.add("hidden");
    document.getElementById("action").classList.add("hidden");
    document.getElementById("planningPanel").style.display = "none";

    const list = document.getElementById("adminList");
    list.innerHTML = "";

    TeamService.getEquipeList().slice().sort((a, b) => a.n.localeCompare(b.n)).forEach(emp => {
      const row = document.createElement("div");
      row.className = "admin-row";

      const left = document.createElement("div");
      left.className = "font-black";
      left.textContent = emp.n;

      const btn = document.createElement("button");
      btn.className = "btn-reset-one";
      btn.type = "button";
      btn.textContent = "Reset";
      btn.onclick = () => {
        if (confirm("Réinitialiser le mobile de " + emp.n + " ?")) {
          db.ref(`broadcast/resets/${SecurityService.keyStaff(emp.n)}`).set(Date.now());
          UIService.toast("Signal reset envoyé ✅");
        }
      };

      row.appendChild(left);
      row.appendChild(btn);
      list.appendChild(row);
    });

    if (!silent) UIService.toast("Supervision gérant activée 🛠️");
  }

  function init() {
    document.getElementById("btnCloseAdmin")?.addEventListener("click", () => {
      document.getElementById("adminWrap").style.display = "none";
      document.getElementById("planningPanel").style.display = "block";
      const selected = StorageService.getSelectedStaff();
      if (selected) {
        document.getElementById("selection").classList.add("hidden");
        document.getElementById("action").classList.remove("hidden");
      } else {
        document.getElementById("selection").classList.remove("hidden");
        document.getElementById("action").classList.add("hidden");
      }
    });

    document.getElementById("btnResetAll")?.addEventListener("click", () => {
      if (currentRole !== "gerant") return;
      if (confirm("Réinitialiser TOUS les mobiles des équipes ?")) {
        db.ref("broadcast/resetPunchesAt").set(Date.now());
        UIService.toast("Signal de réinitialisation globale envoyé ✅");
      }
    });

    // Triple-clic sur le logo pour ouvrir la supervision
    let logoClicks = 0, logoTimer;
    document.getElementById("logo")?.addEventListener("click", () => {
      logoClicks++;
      clearTimeout(logoTimer);
      if (logoClicks === 3) {
        logoClicks = 0;
        if (currentRole === "gerant") openAdmin(false);
        else UIService.toast("Supervision : réservée au gérant");
      }
      logoTimer = setTimeout(() => { logoClicks = 0; }, 650);
    });
  }

  function attachBroadcastListener() {
    const bc = db.ref("broadcast");
    const selected = StorageService.getSelectedStaff();

    if (selected) {
      const staffKey = SecurityService.keyStaff(selected);
      bc.child("resets/" + staffKey).on("value", s => {
        const v = s.val();
        if (!v) return;
        const ackKey = `gc_ack_reset_one__${staffKey}`;
        const last = Number(sessionStorage.getItem(ackKey) || 0);
        if (Number(v) <= last) return;
        sessionStorage.setItem(ackKey, String(v));
        UIService.toast("Reset reçu ✅");
        StorageService.resetAll();
        setTimeout(() => location.reload(), 250);
      });
    }

    bc.child("resetPunchesAt").on("value", s => {
      const v = s.val();
      if (!v) return;
      const last = Number(sessionStorage.getItem("gc_ack_resetPunchesAt") || 0);
      if (Number(v) <= last) return;
      sessionStorage.setItem("gc_ack_resetPunchesAt", String(v));
      UIService.toast("Reset global reçu ✅");
      StorageService.resetAll();
      setTimeout(() => location.reload(), 250);
    });

    bc.child("resetPinsAt").on("value", s => {
      const v = s.val();
      if (!v) return;
      const last = Number(sessionStorage.getItem("gc_ack_resetPinsAt") || 0);
      if (Number(v) <= last) return;
      sessionStorage.setItem("gc_ack_resetPinsAt", String(v));
      UIService.toast("Reset PIN reçu ✅");
      localStorage.removeItem("gc_device_pin");
      StorageService.clearSelectedStaff();
      setTimeout(() => location.reload(), 250);
    });
  }

  return {
    init,
    setRole: (r) => { currentRole = r; },
    attachBroadcastListener
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 10. AUTH & APPLICATION LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────
const App = (() => {
  let homeInt = null;

  async function fetchSheetMessage() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6500);
      const r = await fetch(Config.endpoints.urgentMsgSheet, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      const text = await r.text();
      const json = JSON.parse(text.substr(47).slice(0, -2));
      const rows = json?.table?.rows || [];
      return {
        type: String(rows[0]?.c?.[0]?.v || "").trim().toUpperCase(),
        msg: String(rows[0]?.c?.[1]?.v || "").trim()
      };
    } catch (e) {
      return { type: "", msg: "" };
    }
  }

  async function loadHomeAndBanner() {
    const { type, msg } = await fetchSheetMessage();

    const homeBox = document.getElementById("homeMsg");
    const homeContent = document.getElementById("homeMsgContent");
    const bannerWrap = document.getElementById("banner-wrap");
    const banner = document.getElementById("banner");

    if (!msg) {
      if (homeBox) homeBox.classList.add("hidden");
      if (bannerWrap) bannerWrap.style.display = "none";
      return;
    }

    const isUrgent = (type === "URGENT" || msg.toUpperCase().includes("URGENT"));

    if (homeBox && homeContent) {
      homeContent.textContent = msg;
      homeBox.classList.remove("hidden", "msg-urgent", "msg-info");
      homeBox.classList.add(isUrgent ? "msg-urgent" : "msg-info");
    }

    if (bannerWrap && banner) {
      bannerWrap.style.display = "flex";
      banner.textContent = msg;
      banner.className = "banner " + (isUrgent ? "msg-urgent" : "msg-info");
    }
  }

  function showLoginUI() {
    document.getElementById("sessionBar").classList.add("hidden");
    document.getElementById("publicHome").classList.remove("hidden");
    document.getElementById("app-pointage").classList.add("hidden");
    loadHomeAndBanner();
    clearInterval(homeInt);
    homeInt = setInterval(loadHomeAndBanner, 30000);
  }

  function showLoggedUI(role) {
    document.getElementById("sessionBar").classList.remove("hidden");
    document.getElementById("publicHome").classList.add("hidden");
    document.getElementById("app-pointage").classList.remove("hidden");
    document.getElementById("roleLabel").textContent = (role === "gerant") ? "Gérant" : "Équipe";
    loadHomeAndBanner();
  }

  function showPinBlockIfNeeded() {
    const pb = document.getElementById("pinBlock");
    if (pb) {
      if (!StorageService.hasDevicePin()) pb.classList.remove("hidden");
      else pb.classList.add("hidden");
    }
  }

  function renderStaffSelectionList(equipe) {
    const sel = document.getElementById("selection");
    if (!sel) return;
    sel.innerHTML = `<div class="label-caps text-center mb-3 mt-1">Choisir ton profil</div>`;

    if (!equipe.length) {
      const msg = document.createElement("div");
      msg.style.cssText = "text-align:center;font-size:11px;font-weight:700;color:var(--muted);margin-top:16px";
      msg.textContent = "Aucun collaborateur configuré (settings/equipe).";
      sel.appendChild(msg);
      return;
    }

    const defaultCats = Config.categories;
    const existingCats = Array.from(new Set(equipe.map(e => e.t)));
    const cats = Array.from(new Set([...defaultCats, ...existingCats]));

    cats.forEach(cat => {
      const staff = equipe.filter(e => e.t === cat);
      if (!staff.length) return;

      const h = document.createElement("div");
      h.className = "drawer-header";
      h.innerHTML = `<span class="poste-badge">${cat} (${staff.length})</span><span class="gold" style="font-size:11px;opacity:.7">▼</span>`;

      const cont = document.createElement("div");
      cont.className = "hidden grid grid-cols-1 sm:grid-cols-2 gap-2 py-3";
      h.onclick = () => cont.classList.toggle("hidden");

      staff.slice().sort((a, b) => a.n.localeCompare(b.n)).forEach(emp => {
        const photo = StaffPhotoService.getPhotoUrl(emp.n);
        const initials = StaffPhotoService.getInitials(emp.n);

        const card = document.createElement("div");
        card.className = "staff-card";
        card.innerHTML = `
          <div class="staff-thumb">
            ${photo 
              ? `<img src="${photo}" class="staff-thumb-img" alt="${emp.n}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                 <div class="staff-thumb-fallback" style="display:none">${initials}</div>`
              : `<div class="staff-thumb-fallback">${initials}</div>`
            }
          </div>
          <div class="staff-info">
            <div class="staff-name">${emp.n}</div>
            <div class="staff-sub">${cat}</div>
          </div>
        `;
        card.onclick = () => {
          if (confirm("Assigner cet appareil à " + emp.n + " ?")) {
            StorageService.setSelectedStaff(emp.n);
            location.reload();
          }
        };
        cont.appendChild(card);
      });

      sel.appendChild(h);
      sel.appendChild(cont);
    });
  }

  function setupEventHandlers() {
    // Toggle formulaire de login
    document.getElementById("btnShowLogin")?.addEventListener("click", () => {
      document.getElementById("loginWrap")?.classList.toggle("hidden");
      showPinBlockIfNeeded();
    });

    document.getElementById("loginPass")?.addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("btnLogin")?.click();
    });

    // Soumission connexion
    document.addEventListener("click", async e => {
      const btn = e.target.closest("#btnLogin");
      if (!btn) return;

      const email = (document.getElementById("loginEmail")?.value || "").trim();
      const pass = (document.getElementById("loginPass")?.value || "").trim();
      const pin = (document.getElementById("loginPin")?.value || "").trim();
      const msgEl = document.getElementById("loginMsg");
      if (msgEl) msgEl.textContent = "";

      if (!email || !pass) {
        if (msgEl) msgEl.textContent = "Email et mot de passe requis.";
        return;
      }

      if (!StorageService.hasDevicePin() && !/^\d{4}$/.test(pin)) {
        if (msgEl) msgEl.textContent = "PIN requis (4 chiffres).";
        return;
      }

      btn.disabled = true;
      try {
        const res = await auth.signInWithEmailAndPassword(email, pass);
        const userSnap = await db.ref("users/" + res.user.uid).once("value");
        const role = userSnap.val();

        if (role !== "gerant" && role !== "equipe") {
          await auth.signOut();
          if (msgEl) msgEl.textContent = "Compte non autorisé.";
          btn.disabled = false;
          return;
        }

        if (!StorageService.hasDevicePin()) {
          const hashed = await SecurityService.hashPin(pin);
          StorageService.setDevicePinHash(hashed);
        }
        location.reload();
      } catch (err) {
        if (msgEl) msgEl.textContent = err?.message || "Erreur d'authentification.";
        btn.disabled = false;
      }
    });

    // Déconnexion
    document.getElementById("btnLogout")?.addEventListener("click", async () => {
      try { await auth.signOut(); } catch (e) {}
      location.reload();
    });

    // Réinitialisation de l'appareil (Code PIN)
    document.getElementById("btnResetDevice")?.addEventListener("click", async () => {
      const storedHash = StorageService.getDevicePinHash();
      if (!storedHash) {
        const newPin = prompt("Aucun PIN défini sur cet appareil.\nCréez un PIN à 4 chiffres :");
        if (newPin === null) return;
        if (!/^\d{4}$/.test(newPin)) { UIService.toast("PIN invalide (4 chiffres) ❌"); return; }
        const hashed = await SecurityService.hashPin(newPin);
        StorageService.setDevicePinHash(hashed);
        UIService.toast("Code PIN créé ✅");
        return;
      }

      const pin = prompt("Entrez le code PIN (4 chiffres) pour réinitialiser cet appareil :");
      if (pin === null) return;
      const isValid = await SecurityService.verifyPin(pin, storedHash);

      if (isValid) {
        StorageService.resetAll();
        UIService.toast("Appareil réinitialisé avec succès ✅");
        setTimeout(() => location.reload(), 400);
      } else {
        UIService.toast("Code PIN incorrect ❌");
      }
    });
  }

  function init() {
    UIService.initNetworkListener();
    HistoryService.initControls();
    PunchController.init();
    AdminController.init();
    setupEventHandlers();

    auth.onAuthStateChanged(async user => {
      if (!user) {
        AdminController.setRole(null);
        showLoginUI();
        showPinBlockIfNeeded();
        return;
      }

      const snap = await db.ref("users/" + user.uid).once("value");
      const role = snap.val();

      if (role !== "gerant" && role !== "equipe") {
        await auth.signOut();
        AdminController.setRole(null);
        showLoginUI();
        showPinBlockIfNeeded();
        return;
      }

      AdminController.setRole(role);
      showLoggedUI(role);
      showPinBlockIfNeeded();
      AdminController.attachBroadcastListener();

      TeamService.attachListener(equipeList => {
        const selected = StorageService.getSelectedStaff();
        if (selected) {
          const staffKey = SecurityService.keyStaff(selected);
          const exists = equipeList.some(e => SecurityService.keyStaff(e.n) === staffKey);
          if (!exists) {
            StorageService.clearSelectedStaff();
            location.reload();
            return;
          }

          document.getElementById("selection").classList.add("hidden");
          document.getElementById("action").classList.remove("hidden");
          document.getElementById("planningPanel").style.display = "block";
          document.getElementById("username").textContent = selected;

          // Photo ou Monogramme & Badge de rôle Design 2
          const staffObj = equipeList.find(e => SecurityService.keyStaff(e.n) === staffKey || e.n === selected);
          const roleName = staffObj?.t ? staffObj.t.toUpperCase() : "SERVICE";
          
          const avatarContainer = document.getElementById("avatarContainer");
          const photoUrl = StaffPhotoService.getPhotoUrl(selected);
          const initials = StaffPhotoService.getInitials(selected);

          if (avatarContainer) {
            if (photoUrl) {
              avatarContainer.innerHTML = `
                <img src="${photoUrl}" alt="${selected}" class="avatar-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <div class="avatar-inner" style="display:none">${initials}</div>
              `;
            } else {
              avatarContainer.innerHTML = `<div class="avatar-inner">${initials}</div>`;
            }
          }

          const badgeEl = document.getElementById("userRoleBadge");
          if (badgeEl) badgeEl.textContent = roleName;

          const dStr = TimeService.currentDateStr();
          if (StorageService.isPunchedLocal(dStr, staffKey)) {
            UIService.renderPointedBox(StorageService.getPunchedTimeLocal(dStr, staffKey), dStr);
          } else {
            GpsService.checkGPS(false);
          }
          HistoryService.loadHistorique(staffKey);
        } else {
          document.getElementById("selection").classList.remove("hidden");
          document.getElementById("action").classList.add("hidden");
          document.getElementById("planningPanel").style.display = "block";
          renderStaffSelectionList(equipeList);
        }
      });
    });
  }

  return { init };
})();

// Lancement de l'application
document.addEventListener("DOMContentLoaded", () => App.init());
