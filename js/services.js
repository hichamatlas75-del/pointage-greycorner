/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 2 : Services Fondamentaux (Temps, Sécurité, Photos, Stockage, GPS)
 * =========================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. TIME SERVICE (Anti-fraude Horodatage Serveur GMT)
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
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: Config.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(getTrustedDate());
      const y = parts.find(p => p.type === "year")?.value;
      const m = parts.find(p => p.type === "month")?.value;
      const d = parts.find(p => p.type === "day")?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch (e) {}
    const d = getTrustedDate();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function currentTimeHHMM() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: Config.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(getTrustedDate());
      let h = parts.find(p => p.type === "hour")?.value || "00";
      let m = parts.find(p => p.type === "minute")?.value || "00";
      if (h === "24") h = "00";
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    } catch (e) {}
    const d = getTrustedDate();
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
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
// 2. SECURITY & NORMALIZATION SERVICE
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

  // Hashage SHA-256 avec sel pour le code PIN
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
// 3. STAFF PHOTO SERVICE (Cartographie & Tolérance Phonétique)
// ─────────────────────────────────────────────────────────────────────────
const StaffPhotoService = (() => {
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

    if (PHOTO_MAP[clean]) return PHOTO_MAP[clean];

    const simpleClean = simplify(clean);
    for (const [key, url] of Object.entries(PHOTO_MAP)) {
      if (simplify(key) === simpleClean) return url;
    }

    for (const [key, url] of Object.entries(PHOTO_MAP)) {
      if (clean.includes(key) || key.includes(clean)) return url;
    }

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

// ─────────────────────────────────────────────────────────────────────────
// 4. STORAGE SERVICE (Persistance Locale & Clés Appareil)
// ─────────────────────────────────────────────────────────────────────────
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
// 5. GPS SERVICE (Géolocalisation & Vérification de Rayon)
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
      if (typeof UIService !== "undefined") {
        UIService.setPunchButtonEnabled(false);
        UIService.showRetryGPS(false);
      }
      return;
    }

    const lockKey = `${dStr}__${staffKey}`;
    if (!force && lastCheckedKey === lockKey && (state === "ok" || state === "bad" || state === "denied" || state === "error")) {
      return;
    }

    lastCheckedKey = lockKey;
    state = "searching";
    if (typeof UIService !== "undefined") {
      UIService.updateGpsUI({
        text: "Recherche GPS…",
        textColor: "var(--muted)",
        dotState: "searching",
        canPunch: false,
        showRetry: false
      });
    }

    if (!navigator.geolocation) {
      state = "error";
      if (typeof UIService !== "undefined") {
        UIService.updateGpsUI({
          text: "GPS non supporté",
          textColor: "var(--red)",
          dotState: "error",
          canPunch: false,
          showRetry: false
        });
      }
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
          if (typeof UIService !== "undefined") {
            UIService.updateGpsUI({
              text: "Position validée ✓",
              textColor: "var(--green)",
              dotState: "ok",
              canPunch: true,
              showRetry: false
            });
          }
        } else {
          state = "bad";
          if (typeof UIService !== "undefined") {
            UIService.updateGpsUI({
              text: `Hors zone · ${Math.round(distance)}m`,
              textColor: "var(--red)",
              dotState: "bad",
              canPunch: false,
              showRetry: true
            });
          }
        }
      },
      err => {
        const code = err?.code;
        state = (code === 1) ? "denied" : "error";
        const text = (code === 1) ? "GPS refusé — autorisez la position" : (code === 3) ? "GPS trop lent" : "Erreur signal GPS";
        if (typeof UIService !== "undefined") {
          UIService.updateGpsUI({
            text,
            textColor: "var(--red)",
            dotState: state,
            canPunch: false,
            showRetry: true
          });
        }
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
