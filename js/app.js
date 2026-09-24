/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 6 : Contrôleur de Pointage & Cycle de Vie Applicatif
 * =========================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. PUNCH & POINTAGE CONTROLLER
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
    if (!selected) {
      UIService.toast("Aucun profil sélectionné ❌");
      return;
    }

    const staffKey = SecurityService.keyStaff(selected);
    const dStr = TimeService.currentDateStr();
    const hA = TimeService.currentTimeHHMM();
    const ts = TimeService.getTrustedDate().getTime();

    UIService.setPunchButtonEnabled(false);

    // 1. Vérification locale
    if (StorageService.isPunchedLocal(dStr, staffKey)) {
      const localTime = StorageService.getPunchedTimeLocal(dStr, staffKey);
      UIService.toast("Déjà pointé aujourd'hui ✅");
      UIService.renderPointedBox(localTime || hA, dStr);
      return;
    }

    // 2. Vérification sur Firebase (cas reconnexion ou saisie gérant)
    try {
      const [punchSnap, presSnap] = await Promise.all([
        db.ref(`punches/${dStr}/${staffKey}`).once("value"),
        db.ref(`presences/${dStr}/${staffKey}`).once("value")
      ]);
      const pVal = punchSnap.val();
      const prVal = presSnap.val();
      const existingHA = pVal?.hA || prVal?.hA || null;

      if (existingHA) {
        StorageService.setPunchedLocal(dStr, staffKey, existingHA);
        UIService.toast("Déjà pointé aujourd'hui ✅");
        const effectiveHP = TeamService.getEffectiveHP(staffKey, dStr, prVal?.hP || "");
        const chkHasHP = Boolean(effectiveHP);
        const chkLateMin = chkHasHP ? HistoryService.calculateLateMinutes(effectiveHP, existingHA, staffKey, dStr) : 0;
        UIService.renderPointedBox(existingHA, dStr, { hasHP: chkHasHP, isLate: chkLateMin > 0, lateMin: chkLateMin });
        HistoryService.loadHistorique(staffKey);
        return;
      }
    } catch (e) {}

    // 3. Vérification GPS
    if (GpsService.getState() !== "ok") {
      UIService.toast("GPS non validé ❌");
      GpsService.checkGPS(true);
      return;
    }

    UIService.setPunchButtonEnabled(false);
    UIService.toast("Enregistrement en cours… ⏳");

    let hasHP = false;
    let retard = false;
    let retardMin = 0;

    try {
      const presSnap = await db.ref(`presences/${dStr}/${staffKey}`).once("value");
      const presVal = presSnap.val();
      const effectiveHP = TeamService.getEffectiveHP(staffKey, dStr, presVal?.hP || "");
      if (effectiveHP) {
        hasHP = true;
        const lm = HistoryService.calculateLateMinutes(effectiveHP, hA, staffKey, dStr);
        if (lm > 0) {
          retard = true;
          retardMin = lm;
        }
      }
    } catch (e) {}

    // Schéma exact conforme aux règles de sécurité Firebase Database
    const payload = {
      empKey: staffKey,
      hA: String(hA),
      retard: Boolean(retard),
      retardMin: Number(retardMin) || 0,
      timestamp: Number(ts)
    };

    try {
      await db.ref(`punches/${dStr}/${staffKey}`).set(payload);
    } catch (e) {
      console.warn("Firebase Punch write caught, checking remote status:", e);
      try {
        const [pCheck, prCheck] = await Promise.all([
          db.ref(`punches/${dStr}/${staffKey}`).once("value"),
          db.ref(`presences/${dStr}/${staffKey}`).once("value")
        ]);
        const serverHA = pCheck.val()?.hA || prCheck.val()?.hA || null;
        if (serverHA) {
          StorageService.setPunchedLocal(dStr, staffKey, serverHA);
          UIService.toast("Déjà pointé aujourd'hui ✅");
          const prV = prCheck.val();
          const effectiveHP = TeamService.getEffectiveHP(staffKey, dStr, prV?.hP || "");
          const chkHasHP = Boolean(effectiveHP);
          const chkLateMin = chkHasHP ? HistoryService.calculateLateMinutes(effectiveHP, serverHA, staffKey, dStr) : 0;
          UIService.renderPointedBox(serverHA, dStr, { hasHP: chkHasHP, isLate: chkLateMin > 0, lateMin: chkLateMin });
          HistoryService.loadHistorique(staffKey);
          return;
        }
      } catch (errCheck) {}

      UIService.toast("Erreur de connexion Firebase ❌");
      UIService.setPunchButtonEnabled(GpsService.getState() === "ok");
      UIService.showRetryGPS(GpsService.getState() !== "ok");
      return;
    }

    StorageService.setPunchedLocal(dStr, staffKey, hA);
    if (hasHP) {
      if (retard) {
        if (retardMin <= 10) {
          UIService.toast(`Pointage validé : Léger retard +${retardMin} min ⏰😐`);
        } else {
          UIService.toast(`Pointage validé : Retard +${retardMin} min 😔👎`);
        }
      } else {
        UIService.toast(`Pointage validé ! Bravo, à l'heure 😊👍`);
      }
    } else {
      UIService.toast("Pointage validé avec succès ✅");
    }
    UIService.renderPointedBox(hA, dStr, { hasHP, isLate: retard, lateMin: retardMin });
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
// 2. AUTH & APPLICATION LIFECYCLE
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

          // Photo ou Monogramme & Badge de rôle
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
            // Vérification directe sur Firebase (cas déconnexion/reconnexion ou saisie gérant)
            Promise.allSettled([
              db.ref(`punches/${dStr}/${staffKey}`).once("value"),
              db.ref(`presences/${dStr}/${staffKey}`).once("value")
            ]).then(([pRes, prRes]) => {
              const pVal = pRes.status === "fulfilled" ? pRes.value?.val() : null;
              const prVal = prRes.status === "fulfilled" ? prRes.value?.val() : null;
              const serverTime = pVal?.hA || prVal?.hA || null;

              if (serverTime) {
                StorageService.setPunchedLocal(dStr, staffKey, serverTime);
                const effectiveHP = TeamService.getEffectiveHP(staffKey, dStr, prVal?.hP || "");
                const chkHasHP = Boolean(effectiveHP);
                const chkLateMin = chkHasHP ? HistoryService.calculateLateMinutes(effectiveHP, serverTime, staffKey, dStr) : 0;
                UIService.renderPointedBox(serverTime, dStr, { hasHP: chkHasHP, isLate: chkLateMin > 0, lateMin: chkLateMin });
              } else {
                GpsService.checkGPS(false);
              }
            }).catch(() => {
              GpsService.checkGPS(false);
            });
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
