/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 4 : Interface Utilisateur & Contrôleur d'Administration
 * =========================================================================
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. UI SERVICE & TOAST & AFFICHAGE DU POINTAGE
// ─────────────────────────────────────────────────────────────────────────
const UIService = (() => {
  let toastTimer = null;

  // SÉCURITÉ : Échappement des caractères HTML pour prévenir les injections XSS
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

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

  function renderPointedBox(hhmm, dStr, meta = null) {
    const zone = document.getElementById("pointage-zone");
    if (!zone) return;
    const status = document.getElementById("status");

    const wrap = document.getElementById("btnMainWrap");
    if (wrap) wrap.style.display = "none";
    showRetryGPS(false);
    setPunchButtonEnabled(false);

    let box = document.getElementById("pointedBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "pointedBox";
      zone.appendChild(box);
    }

    const hasHP = meta ? Boolean(meta.hasHP) : false;
    const isLate = meta ? Boolean(meta.isLate) : false;
    const lateMin = meta ? Number(meta.lateMin || 0) : 0;

    if (hasHP && !isLate) {
      // 1. À l'heure avec HP : Smiley souriant avec pouce de bravo 😊👍
      box.className = "pointed-box pointed-ontime";
      if (status) {
        status.textContent = "À l'heure 😊👍";
        status.style.color = "var(--emerald-neon)";
      }
      updateGpsDot("ok");
      box.innerHTML = `
        <div class="pointed-check pointed-check-ontime">
          <span style="font-size:22px;line-height:1">😊👍</span>
        </div>
        <div class="pointed-msg pointed-msg-ontime">Bravo ! Vous êtes à l'heure 😊👍</div>
        <div class="pointed-time">${escapeHtml(hhmm) || "—"}</div>
        <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${escapeHtml(dStr)}</div>
      `;
    } else if (hasHP && isLate) {
      if (lateMin <= 15) {
        // 2a. Léger retard (1 à 15 min) : Emoji tolérance ⏰😐 (Orange)
        box.className = "pointed-box pointed-mild-late";
        if (status) {
          status.textContent = `Retard +${lateMin} min ⏰😐`;
          status.style.color = "var(--amber-electric)";
        }
        updateGpsDot("ok");
        box.innerHTML = `
          <div class="pointed-check pointed-check-mild-late">
            <span style="font-size:22px;line-height:1">⏰😐</span>
          </div>
          <div class="pointed-msg pointed-msg-mild-late">Léger retard : +${escapeHtml(String(lateMin))} min ⏰😐</div>
          <div class="pointed-time pointed-time-mild-late">${escapeHtml(hhmm) || "—"}</div>
          <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${escapeHtml(dStr)}</div>
        `;
      } else {
        // 2b. Retard avéré (> 15 min) : Emoji alerte 😔👎 (Rouge)
        box.className = "pointed-box pointed-late";
        if (status) {
          status.textContent = `Retard +${lateMin} min 😔👎`;
          status.style.color = "var(--coral-electric)";
        }
        updateGpsDot("ok");
        box.innerHTML = `
          <div class="pointed-check pointed-check-late">
            <span style="font-size:22px;line-height:1">😔👎</span>
          </div>
          <div class="pointed-msg pointed-msg-late">Attention : Retard de +${escapeHtml(String(lateMin))} min 😔👎</div>
          <div class="pointed-time pointed-time-late">${escapeHtml(hhmm) || "—"}</div>
          <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${escapeHtml(dStr)}</div>
        `;
      }
    } else {
      // 3. HP non attribué : Présence standard
      box.className = "pointed-box";
      if (status) {
        status.textContent = "Pointé ✓";
        status.style.color = "var(--emerald-neon)";
      }
      updateGpsDot("ok");
      box.innerHTML = `
        <div class="pointed-check">✓</div>
        <div class="label-caps mb-1" style="color:var(--emerald-neon);letter-spacing:.15em">Présence enregistrée</div>
        <div class="pointed-time">${escapeHtml(hhmm) || "—"}</div>
        <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${escapeHtml(dStr)}</div>
      `;
    }
    box.style.display = "block";
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

  function showLateReasonModal({ retardMin, effectiveHP, hA, onSubmit, onSkip }) {
    const modal = document.getElementById("lateModal");
    const badge = document.getElementById("lateModalBadge");
    const times = document.getElementById("lateModalTimes");
    const textarea = document.getElementById("lateReasonInput");
    const btnSkip = document.getElementById("btnSkipLateReason");
    const btnSubmit = document.getElementById("btnSubmitLateReason");
    const pills = document.querySelectorAll(".late-pill-btn");

    if (!modal) {
      if (onSkip) onSkip();
      return;
    }

    if (badge) badge.textContent = `⏰ Retard constaté : +${retardMin} min`;
    if (times) times.textContent = `Heure prévue : ${effectiveHP || "--"} • Arrivée : ${hA || "--"}`;
    if (textarea) textarea.value = "";

    let selectedPillReason = "";
    pills.forEach(pill => {
      pill.classList.remove("active");
      pill.onclick = () => {
        if (pill.classList.contains("active")) {
          pill.classList.remove("active");
          selectedPillReason = "";
        } else {
          pills.forEach(p => p.classList.remove("active"));
          pill.classList.add("active");
          selectedPillReason = pill.getAttribute("data-reason") || "";
        }
      };
    });

    function cleanup() {
      modal.classList.add("hidden");
      if (btnSkip) btnSkip.onclick = null;
      if (btnSubmit) btnSubmit.onclick = null;
      pills.forEach(p => p.onclick = null);
    }

    if (btnSkip) {
      btnSkip.onclick = () => {
        cleanup();
        if (onSkip) onSkip();
      };
    }

    if (btnSubmit) {
      btnSubmit.onclick = () => {
        const textReason = textarea ? textarea.value.trim() : "";
        let finalReason = selectedPillReason;
        if (textReason) {
          finalReason = finalReason ? `${finalReason} : ${textReason}` : textReason;
        }
        cleanup();
        if (onSubmit) onSubmit(finalReason);
      };
    }

    modal.classList.remove("hidden");
    if (textarea) setTimeout(() => textarea.focus(), 150);
  }

  return {
    toast,
    updateGpsDot,
    setPunchButtonEnabled,
    showRetryGPS,
    updateGpsUI,
    renderPointedBox,
    initNetworkListener,
    showLateReasonModal
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// 2. ADMIN & BROADCAST CONTROLLER
// ─────────────────────────────────────────────────────────────────────────
const AdminController = (() => {
  let currentRole = null;

  async function openAdmin(silent = false) {
    if (currentRole !== "gerant") return;
    const wrap = document.getElementById("adminWrap");
    if (!wrap) return;
    wrap.style.display = "flex";
    document.getElementById("selection")?.classList.add("hidden");
    document.getElementById("action")?.classList.add("hidden");
    const planPanel = document.getElementById("planningPanel");
    if (planPanel) planPanel.style.display = "none";

    const list = document.getElementById("adminList");
    if (list) list.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:11px">Chargement des présences du jour… ⏳</div>`;

    const dStr = TimeService.currentDateStr();
    let punchesMap = {};
    let presencesMap = {};

    try {
      const [puSnap, prSnap] = await Promise.all([
        db.ref("punches/" + dStr).once("value"),
        db.ref("presences/" + dStr).once("value")
      ]);
      punchesMap = puSnap.val() || {};
      presencesMap = prSnap.val() || {};
    } catch (e) {
      console.warn("Erreur chargement données supervision:", e);
    }

    const equipe = TeamService.getEquipeList().slice().sort((a, b) => a.n.localeCompare(b.n));
    let presentCount = 0;
    let lateCount = 0;
    let pendingCount = 0;

    const frag = document.createDocumentFragment();

    equipe.forEach(emp => {
      const staffKey = SecurityService.keyStaff(emp.n);
      const pu = punchesMap[staffKey] || null;
      const pr = presencesMap[staffKey] || null;

      const hA = pu?.hA || pr?.hA || "";
      const effectiveHP = TeamService.getEffectiveHP(staffKey, dStr, pr?.hP || pu?.hP || "");
      let isLate = false;
      let lateMin = 0;

      if (hA && effectiveHP) {
        lateMin = HistoryService.calculateLateMinutes(effectiveHP, hA, staffKey, dStr);
        isLate = lateMin > 0;
      } else if (pu?.retard || pr?.retard) {
        isLate = true;
        lateMin = pu?.retardMin || pr?.retardMin || 0;
      }

      const motif = (pu?.motif || pr?.motif || "").trim();

      if (hA) {
        presentCount++;
        if (isLate) lateCount++;
      } else {
        pendingCount++;
      }

      const row = document.createElement("div");
      row.className = "admin-staff-row";

      // Ligne supérieure : Nom, Poste, Statut, Bouton Reset
      let statusBadge = "";
      if (hA) {
        if (isLate) {
          if (lateMin <= 15) {
            statusBadge = `<span class="admin-status-badge admin-status-mild">⏰ +${lateMin}m (${escapeHtml(hA)})</span>`;
          } else {
            statusBadge = `<span class="admin-status-badge admin-status-late">😔 +${lateMin}m (${escapeHtml(hA)})</span>`;
          }
        } else {
          statusBadge = `<span class="admin-status-badge admin-status-ontime">✓ À l'heure (${escapeHtml(hA)})</span>`;
        }
      } else {
        statusBadge = `<span class="admin-status-badge admin-status-none">Non pointé</span>`;
      }

      const safeName = escapeHtml(emp.n);
      const safeRole = escapeHtml(emp.t || "service");

      row.innerHTML = `
        <div class="admin-staff-top">
          <div class="admin-staff-name">
            <span>${safeName}</span>
            <span class="admin-staff-role">${safeRole}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${statusBadge}
            <button class="btn-reset-one" type="button" data-staff="${safeName}">Reset</button>
          </div>
        </div>
        ${motif ? `<div class="admin-motif-box">💬 Motif : « ${escapeHtml(motif)} »</div>` : (isLate && lateMin > 15 ? `<div class="admin-motif-box" style="border-color:var(--text-muted);color:var(--text-secondary);background:rgba(255,255,255,0.03)">⚠️ Aucun motif renseigné</div>` : "")}
      `;

      row.querySelector(".btn-reset-one")?.addEventListener("click", () => {
        if (confirm("Réinitialiser le mobile de " + emp.n + " ?")) {
          db.ref(`broadcast/resets/${staffKey}`).set(Date.now());
          UIService.toast("Signal reset envoyé ✅");
        }
      });

      frag.appendChild(row);
    });

    if (list) {
      list.replaceChildren(frag);
    }

    // Mise à jour des compteurs statistiques
    const elPres = document.getElementById("adminStatPresent");
    const elLate = document.getElementById("adminStatLate");
    const elPend = document.getElementById("adminStatPending");
    if (elPres) elPres.textContent = presentCount;
    if (elLate) elLate.textContent = lateCount;
    if (elPend) elPend.textContent = pendingCount;

    if (!silent) UIService.toast("Supervision RH & Gérant activée 🛠️");
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
