/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 3 : Plannings & Règles Métier (Cuisine, Bar, Service, Caisse, Équipe)
 * =========================================================================
 */

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

  // ─── PLANNING FIXE CUISINE (Hebdomadaire) ───
  // 0 = Dimanche, 1 = Lundi, 2 = Mardi, 3 = Mercredi, 4 = Jeudi, 5 = Vendredi, 6 = Samedi
  const PLANNING_CUISINE = {
    1: { // Lundi
      NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
      KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
      FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
      JIHANE:  { hP: "12:00", off: false, shift: "12h — 21h" },
      IMANE:   { hP: "",      off: true,  shift: "OFF" },
      ANAS:    { hP: "14:00", off: false, shift: "14h — F.S" },
      JAWAD:   { hP: "",      off: true,  shift: "OFF" },
      SAAD:    { hP: "14:00", off: false, shift: "14h — F.S" }
    },
    2: { // Mardi
      NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
      KHAOULA: { hP: "",      off: true,  shift: "OFF" },
      FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
      JIHANE:  { hP: "15:00", off: false, shift: "15h — F.S" },
      IMANE:   { hP: "07:00", off: false, shift: "07h — 14h" },
      ANAS:    { hP: "12:00", off: false, shift: "12h — 21h" },
      JAWAD:   { hP: "12:00", off: false, shift: "12h — 15h / 17h - F.S" },
      SAAD:    { hP: "",      off: true,  shift: "OFF" }
    },
    3: { // Mercredi
      NAOUAL:  { hP: "",      off: true,  shift: "OFF" },
      KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
      FATIMA:  { hP: "",      off: true,  shift: "OFF" },
      JIHANE:  { hP: "14:00", off: false, shift: "14h — F.S" },
      IMANE:   { hP: "07:00", off: false, shift: "07h — 14h" },
      ANAS:    { hP: "",      off: true,  shift: "OFF" },
      JAWAD:   { hP: "15:00", off: false, shift: "15h — F.S" },
      SAAD:    { hP: "12:00", off: false, shift: "12h — 15h / 17h - F.S" }
    },
    4: { // Jeudi
      NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
      KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
      FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
      JIHANE:  { hP: "",      off: true,  shift: "OFF" },
      IMANE:   { hP: "12:00", off: false, shift: "12h — 21h" },
      ANAS:    { hP: "15:00", off: false, shift: "15h — F.S" },
      JAWAD:   { hP: "12:00", off: false, shift: "12h — 21h" },
      SAAD:    { hP: "14:00", off: false, shift: "14h — F.S" }
    },
    5: { // Vendredi
      NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
      KHAOULA: { hP: "07:00", off: false, shift: "07h — 14h" },
      FATIMA:  { hP: "07:00", off: false, shift: "07h — 14h" },
      JIHANE:  { hP: "12:00", off: false, shift: "12h — 15h / 17h - F.S" },
      IMANE:   { hP: "12:00", off: false, shift: "12h — 21h" },
      ANAS:    { hP: "13:00", off: false, shift: "13h — F.S" },
      JAWAD:   { hP: "14:00", off: false, shift: "14h — F.S" },
      SAAD:    { hP: "15:00", off: false, shift: "15h — F.S" }
    },
    6: { // Samedi
      NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
      KHAOULA: { hP: "07:00", off: false, shift: "07h — 15h" },
      FATIMA:  { hP: "07:00", off: false, shift: "07h — 15h" },
      JIHANE:  { hP: "14:00", off: false, shift: "14h — F.S" },
      IMANE:   { hP: "10:00", off: false, shift: "10h — 18h" },
      ANAS:    { hP: "14:00", off: false, shift: "14h — F.S" },
      JAWAD:   { hP: "14:00", off: false, shift: "14h — F.S" },
      SAAD:    { hP: "13:00", off: false, shift: "13h — F.S" }
    },
    0: { // Dimanche
      NAOUAL:  { hP: "15:00", off: false, shift: "15h — F.S" },
      KHAOULA: { hP: "07:00", off: false, shift: "07h — 15h" },
      FATIMA:  { hP: "07:00", off: false, shift: "07h — 15h" },
      JIHANE:  { hP: "14:00", off: false, shift: "14h — F.S" },
      IMANE:   { hP: "10:00", off: false, shift: "10h — 18h" },
      ANAS:    { hP: "14:00", off: false, shift: "14h — F.S" },
      JAWAD:   { hP: "14:00", off: false, shift: "14h — F.S" },
      SAAD:    { hP: "14:00", off: false, shift: "14h — 21h" }
    }
  };

  function matchCuisineStaffKey(nameOrKey) {
    if (!nameOrKey) return null;
    const s = String(nameOrKey).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes("NAOUAL") || s.includes("BOUCHNAK")) return "NAOUAL";
    if (s.includes("KHAOULA") || s.includes("BELQAS")) return "KHAOULA";
    if (s.includes("FATIMA") || s.includes("ZAIR")) return "FATIMA";
    if (s.includes("JIHANE") || s.includes("MAJDOUB")) return "JIHANE";
    if (s.includes("IMANE") || s.includes("MOUJAHID")) return "IMANE";
    if (s.includes("ANAS") || s.includes("BOURAHMA")) return "ANAS";
    if (s.includes("JAWAD") || s.includes("JAOUAD") || s.includes("LEMSSIEH") || s.includes("LAMSSIAH")) return "JAWAD";
    if (s.includes("SAAD") || s.includes("IDRISSI")) return "SAAD";
    return null;
  }

  function isCuisineRole(empKey) {
    if (!empKey) return false;
    const member = matchCuisineStaffKey(empKey);
    if (member) return true;
    const e = equipeMap.get(empKey);
    if (e && (e.t === "cuisine")) return true;
    return false;
  }

  function getCuisinePlanning(empKey, dateISO) {
    if (!dateISO) return null;
    const member = matchCuisineStaffKey(empKey);
    if (!member) return null;
    const [yy, mm, dd] = String(dateISO).split("-").map(Number);
    if (!yy || !mm || !dd) return null;
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    const dayOfWeek = dt.getUTCDay();
    return PLANNING_CUISINE[dayOfWeek]?.[member] || null;
  }

  // Plannings dynamiques Google Sheets
  const BAR_SHEET_URL = "https://docs.google.com/spreadsheets/d/1mfwB4zNHS79YsNH4vTMUGOdWeQwC3htMgPtDWsrMbWg/gviz/tq?tqx=out:csv&gid=294813093";
  const SERVICE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1aKrmu7Hdf1tb4_0QFCGC6VYjUVlRKeDJYLYs9qIM6Aw/gviz/tq?tqx=out:csv&gid=0";

  let todaySheetShifts = new Map();

  async function syncTodayGoogleSheets() {
    try {
      const todayISO = TimeService.currentDateStr();
      const [yy, mm, dd] = todayISO.split("-").map(Number);
      const targetDate = new Date(yy, mm - 1, dd);
      targetDate.setHours(0, 0, 0, 0);

      function parseCsvLine(line) {
        const out = []; let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; continue; }
          if (ch === ',' && !inQ) { out.push(cur.trim()); cur=""; continue; }
          cur += ch;
        }
        out.push(cur.trim());
        return out;
      }

      function parseDateLabel(label) {
        if (!label) return null;
        let s = String(label).toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");
        let m = s.match(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
        if (m) { const d = new Date(+m[1], +m[2]-1, +m[3]); d.setHours(0,0,0,0); return d; }
        m = s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
        if (m) { const d = new Date(+m[3], +m[2]-1, +m[1]); d.setHours(0,0,0,0); return d; }
        const months = {
          "janvier":0,"janv":0, "fevrier":1,"fev":1, "mars":2, "mar":2, "avril":3,"avr":3,
          "mai":4, "juin":5, "juillet":6,"juil":6, "aout":7, "septembre":8,"sept":8,
          "octobre":9,"oct":9, "novembre":10,"nov":10, "decembre":11,"dec":11
        };
        m = s.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
        if (m && months.hasOwnProperty(m[2])) {
          const d = new Date(m[3] ? +m[3] : targetDate.getFullYear(), months[m[2]], +m[1]);
          d.setHours(0,0,0,0);
          return d;
        }
        return null;
      }

      async function processSheet(url, roleFilter) {
        const resp = await fetch(url, { cache: "no-store" });
        const text = await resp.text();
        const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
        for (let i = 1; i < rows.length; i++) {
          const c = parseCsvLine(rows[i]);
          if (!c[0] || c[0].toUpperCase().includes("DATE")) continue;
          const rDate = parseDateLabel(c[0]);
          if (rDate && rDate.getFullYear() === targetDate.getFullYear() &&
              rDate.getMonth() === targetDate.getMonth() &&
              rDate.getDate() === targetDate.getDate()) {
            const matin = (c[1] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const soir  = (c[2] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            equipeList.forEach(emp => {
              if (roleFilter && emp.t !== roleFilter) return;
              const empKey = SecurityService.keyStaff(emp.n);
              const fullName = String(emp.n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const words = fullName.split(/[\s_-]+/).filter(w => w.length >= 3 && w !== "el" && w !== "al");

              function checkMatch(shiftText) {
                if (!shiftText) return false;
                if (words.some(w => shiftText.includes(w))) return true;
                if ((fullName.includes("laziz") || fullName.includes("alaoui") || fullName.includes("aziz")) && (shiftText.includes("aziz") || shiftText.includes("laziz"))) return true;
                if ((fullName.includes("mokhtar") || fullName.includes("ktami")) && shiftText.includes("mokhtar")) return true;
                if ((fullName.includes("zakaria") || fullName.includes("kafouni")) && (shiftText.includes("zakaria") || shiftText.includes("zakariae"))) return true;
                if ((fullName.includes("mostafa") || fullName.includes("mustapha") || fullName.includes("elkobbi")) && (shiftText.includes("mostafa") || shiftText.includes("mustapha") || shiftText.includes("mosatafe"))) return true;
                if ((fullName.includes("anas") || fullName.includes("bourahma")) && (shiftText.includes("anas") || shiftText.includes("anass"))) return true;
                return false;
              }

              const inMatin = checkMatch(matin);
              const inSoir  = checkMatch(soir);

              if (inMatin) todaySheetShifts.set(empKey, "07:00");
              else if (inSoir) todaySheetShifts.set(empKey, "14:30");
            });
            break;
          }
        }
      }

      await Promise.allSettled([
        processSheet(BAR_SHEET_URL, "bar"),
        processSheet(SERVICE_SHEET_URL, "service")
      ]);
    } catch (e) {
      console.warn("Échec synchronisation Google Sheets Bar/Service:", e);
    }
  }

  function isSoumia(empKey) {
    if (!empKey) return false;
    const s = String(empKey).toUpperCase();
    return s.includes("SOUMIA") || s.includes("NHAILI") || s.includes("NHAJLI") || s.includes("ENNHAILI");
  }

  function getSoumiaPlanning(dateISO) {
    if (!dateISO) return null;
    const [yy, mm, dd] = String(dateISO).split("-").map(Number);
    if (!yy || !mm || !dd) return null;
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    const dayOfWeek = dt.getUTCDay();
    if (dayOfWeek === 2) {
      return { off: true, hP: null, shift: "OFF" };
    }
    return { off: false, hP: "09:00", shift: "09:00" };
  }

  function isSalil(empKey) {
    if (!empKey) return false;
    const s = String(empKey).toUpperCase();
    return s.includes("SALIL") || s.includes("SALIH") || s.includes("HOUDA");
  }

  function isBenkhada(empKey) {
    if (!empKey) return false;
    const s = String(empKey).toUpperCase();
    return s.includes("BENKHADA") || s.includes("ABDESLAM") || s.includes("ABDESSLAM") || s.includes("ABDELSSAM");
  }

  function getCaisseAlternance(empKey, dateISO) {
    if (!dateISO) return null;
    const [yy, mm, dd] = String(dateISO).split("-").map(Number);
    if (!yy || !mm || !dd) return null;
    const isSal = isSalil(empKey);
    const isBen = isBenkhada(empKey);
    if (!isSal && !isBen) return null;

    const dAnchor = Date.UTC(2026, 8, 24);
    const dTarget = Date.UTC(yy, mm - 1, dd);
    const diffDays = Math.round((dTarget - dAnchor) / 86400000);
    const mod = ((diffDays % 2) + 2) % 2;

    if (mod === 0) {
      return isSal
        ? { hP: "07:30", off: false, shift: "07:30" }
        : { hP: "15:00", off: false, shift: "15:00" };
    } else {
      return isSal
        ? { hP: "15:00", off: false, shift: "15:00" }
        : { hP: "07:30", off: false, shift: "07:30" };
    }
  }

  function getEffectiveHP(empKey, dateISO, presHP = "") {
    if (presHP) return presHP;
    if (isSoumia(empKey)) {
      const plan = getSoumiaPlanning(dateISO);
      if (plan && !plan.off && plan.hP) return plan.hP;
      return "";
    }
    if (isSalil(empKey) || isBenkhada(empKey)) {
      const plan = getCaisseAlternance(empKey, dateISO);
      if (plan && plan.hP) return plan.hP;
      return "";
    }
    if (isSecuriteRole(empKey)) return "09:00";
    const plan = getCuisinePlanning(empKey, dateISO);
    if (plan && !plan.off && plan.hP) return plan.hP;
    if (todaySheetShifts.has(empKey)) return todaySheetShifts.get(empKey);
    return "";
  }

  function attachListener(onUpdate) {
    if (listenerAttached) return;
    listenerAttached = true;
    syncTodayGoogleSheets();
    db.ref("settings/equipe").on("value", snap => {
      equipeList = normalizeSnapshot(snap.val());
      equipeMap = new Map();
      equipeList.forEach(e => equipeMap.set(SecurityService.keyStaff(e.n), e));
      syncTodayGoogleSheets();
      if (onUpdate) onUpdate(equipeList);
    });
  }

  return {
    getEquipeList: () => equipeList,
    isSecuriteRole,
    isCuisineRole,
    getCuisinePlanning,
    getEffectiveHP,
    syncTodayGoogleSheets,
    attachListener
  };
})();
