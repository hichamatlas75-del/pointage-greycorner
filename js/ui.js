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
        <div class="pointed-time">${hhmm || "—"}</div>
        <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${dStr}</div>
      `;
    } else if (hasHP && isLate) {
      if (lateMin <= 10) {
        // 2a. Léger retard (1 à 10 min) : Emoji spécial sans pouce à l'envers ⏰😐
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
          <div class="pointed-msg pointed-msg-mild-late">Léger retard : +${lateMin} min ⏰😐</div>
          <div class="pointed-time pointed-time-mild-late">${hhmm || "—"}</div>
          <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${dStr}</div>
        `;
      } else {
        // 2b. Retard avéré (> 10 min) : Emoji triste avec pouce à l'envers 😔👎
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
          <div class="pointed-msg pointed-msg-late">Attention : Retard de +${lateMin} min 😔👎</div>
          <div class="pointed-time pointed-time-late">${hhmm || "—"}</div>
          <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${dStr}</div>
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
        <div class="pointed-time">${hhmm || "—"}</div>
        <div class="label-caps mt-2" style="font-size:9.5px;color:var(--text-secondary)">${dStr}</div>
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
// 2. ADMIN & BROADCAST CONTROLLER
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
