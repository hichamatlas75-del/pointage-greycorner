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
// 3.1 FEEDBACK SERVICE (Double Moteur Audio + Vibration Haptique Universelle)
// ─────────────────────────────────────────────────────────────────────────
const FeedbackService = (() => {
  let audioCtx = null;
  let isUnlocked = false;

  // Synthétiseur de WAV 16-bit PCM en mémoire (compatibilité totale même si WebAudio est bloqué)
  function createWavDataUri(freq, duration = 0.2, type = "sine") {
    try {
      const sampleRate = 22050;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);

      function writeStr(offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples * 2, true);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = Math.sin(Math.PI * (i / numSamples));
        let sample = Math.sin(2 * Math.PI * freq * t);
        if (type === "triangle") {
          sample = (2 / Math.PI) * Math.asin(Math.max(-1, Math.min(1, sample)));
        }
        sample = sample * envelope * 0.75;
        view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      }

      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return 'data:audio/wav;base64,' + btoa(binary);
    } catch (e) {
      return null;
    }
  }

  // Sons de secours HTML5 Audio pré-générés
  const HTML5_SOUNDS = {
    c5: null, e5: null, g5: null,
    a4: null, f4: null,
    low: null
  };

  function initSounds() {
    if (!HTML5_SOUNDS.c5) {
      HTML5_SOUNDS.c5 = createWavDataUri(523.25, 0.16, "sine");
      HTML5_SOUNDS.e5 = createWavDataUri(659.25, 0.16, "sine");
      HTML5_SOUNDS.g5 = createWavDataUri(783.99, 0.32, "sine");
      HTML5_SOUNDS.a4 = createWavDataUri(440, 0.20, "triangle");
      HTML5_SOUNDS.f4 = createWavDataUri(349.23, 0.36, "triangle");
      HTML5_SOUNDS.low = createWavDataUri(220, 0.38, "triangle");
    }
  }

  function playHtml5Sound(dataUri) {
    if (!dataUri) return;
    try {
      const a = new Audio(dataUri);
      a.volume = 1.0;
      const prom = a.play();
      if (prom && typeof prom.catch === "function") prom.catch(() => {});
    } catch (e) {}
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function unlock() {
    if (isUnlocked) return;
    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") ctx.resume();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        isUnlocked = true;
      }
    } catch (e) {}
    initSounds();
  }

  // Déverrouillage automatique au moindre contact avec l'écran
  if (typeof document !== "undefined") {
    const doUnlock = () => {
      unlock();
      document.removeEventListener("pointerdown", doUnlock);
      document.removeEventListener("touchstart", doUnlock);
      document.removeEventListener("click", doUnlock);
    };
    document.addEventListener("pointerdown", doUnlock, { passive: true });
    document.addEventListener("touchstart", doUnlock, { passive: true });
    document.addEventListener("click", doUnlock, { passive: true });
  }

  function playWebAudioTone(freq, duration = 0.2, type = "sine", delay = 0) {
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state === "suspended") return false;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      const startT = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, startT);
      gain.gain.setValueAtTime(0.5, startT);
      gain.gain.linearRampToValueAtTime(0.01, startT + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startT);
      osc.stop(startT + duration);
      return true;
    } catch (e) {
      return false;
    }
  }

  function trigger(pattern = "success") {
    unlock();

    // 1. VIBRATION HAPTIQUE
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        if (pattern === "success") {
          navigator.vibrate([80, 50, 180]);
        } else if (pattern === "late") {
          navigator.vibrate([150, 60, 150, 60, 240]);
        } else if (pattern === "error") {
          navigator.vibrate([280, 70, 280]);
        } else if (pattern === "tap") {
          navigator.vibrate(60);
        }
      }
    } catch (e) {}

    // 2. RETOUR HAPTIQUE VISUEL SUR L'ÉCRAN (pour iPhone/iOS et navigateurs sans vibreur)
    if (typeof document !== "undefined") {
      const card = document.querySelector(".card");
      if (card) {
        card.classList.remove("haptic-shake");
        void card.offsetWidth;
        card.classList.add("haptic-shake");
        setTimeout(() => card.classList.remove("haptic-shake"), 350);
      }
    }

    // 3. RETOUR SONORE (Web Audio API + HTML5 Audio fallback garanti)
    initSounds();

    if (pattern === "success") {
      // Accord montant Do5 (523Hz) -> Mi5 (659Hz) -> Sol5 (784Hz)
      const played = playWebAudioTone(523.25, 0.14, "sine", 0)
                  && playWebAudioTone(659.25, 0.14, "sine", 0.09)
                  && playWebAudioTone(783.99, 0.30, "sine", 0.18);
      if (!played) {
        playHtml5Sound(HTML5_SOUNDS.c5);
        setTimeout(() => playHtml5Sound(HTML5_SOUNDS.e5), 90);
        setTimeout(() => playHtml5Sound(HTML5_SOUNDS.g5), 180);
      }
    } else if (pattern === "late") {
      // La4 (440Hz) -> Fa4 (349Hz)
      const played = playWebAudioTone(440, 0.18, "triangle", 0)
                  && playWebAudioTone(349.23, 0.34, "triangle", 0.16);
      if (!played) {
        playHtml5Sound(HTML5_SOUNDS.a4);
        setTimeout(() => playHtml5Sound(HTML5_SOUNDS.f4), 160);
      }
    } else if (pattern === "error") {
      // Grave (220Hz)
      const played = playWebAudioTone(220, 0.34, "sawtooth", 0);
      if (!played) {
        playHtml5Sound(HTML5_SOUNDS.low);
      }
    } else if (pattern === "tap") {
      playWebAudioTone(600, 0.06, "sine", 0);
    }
  }

  return { trigger, unlock, getAudioContext };
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
