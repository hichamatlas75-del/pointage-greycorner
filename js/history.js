/**
 * =========================================================================
 * GREY CORNER • POINTAGE & PRÉSENCES
 * Module 5 : Historique & Calcul des Retards (7 Jours & Mensuel)
 * =========================================================================
 */

const HistoryService = (() => {
  const JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const MOIS_FR  = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  const MOIS_LONGS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  let mode = "month"; // "7d" ou "month"
  let currentDate = new Date();

  function calculateLateMinutes(hP, hA, empKey, dateISO = "") {
    if (!hA) return 0;
    const scheduled = TeamService.getEffectiveHP(empKey, dateISO || TimeService.currentDateStr(), hP);
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

    function getStaffRecord(dayMap, key) {
      if (!dayMap || typeof dayMap !== "object") return null;
      if (dayMap[key]) return dayMap[key];
      const clean = SecurityService.keyStaff(key);
      if (dayMap[clean]) return dayMap[clean];
      const simple = StaffPhotoService.normalize(key);
      for (const k of Object.keys(dayMap)) {
        if (SecurityService.keyStaff(k) === clean || StaffPhotoService.normalize(k) === simple) {
          return dayMap[k];
        }
      }
      return null;
    }

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
            db.ref(`punches/${iso}`).once("value").then(s => getStaffRecord(s.val(), staffKey)).catch(() => null),
            db.ref(`presences/${iso}`).once("value").then(s => getStaffRecord(s.val(), staffKey)).catch(() => null)
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
      const pu = getStaffRecord(punchesMap[iso], staffKey);
      const pr = getStaffRecord(presencesMap[iso], staffKey);

      const [, mm, dd] = iso.split("-").map(Number);
      const isMonday = (dt.getDay() === 1);

      const cuisinePlan = TeamService.getCuisinePlanning(staffKey, iso);
      const hA = pu?.hA || pr?.hA || (StorageService.isPunchedLocal(iso, staffKey) ? StorageService.getPunchedTimeLocal(iso, staffKey) : "");
      const hP = TeamService.getEffectiveHP(staffKey, iso, pr?.hP || pu?.hP || "");
      const isOff = pr?.off === true || (isSec && isMonday && !hA) || (!hA && cuisinePlan?.off && pr?.off !== false);

      let lateMin = 0;
      if (hA && hP) {
        lateMin = calculateLateMinutes(hP, hA, staffKey, iso);
      } else if (pr && typeof pr.retardMin === "number" && pr.retardMin > 0) {
        lateMin = pr.retardMin;
      } else if (pu && typeof pu.retardMin === "number" && pu.retardMin > 0) {
        lateMin = pu.retardMin;
      }

      const isLate = (lateMin > 0);
      const isToday = (iso === todayStr);

      if (hA) {
        countPresent++;
        if (isLate) {
          countLate++;
          totalLateMin += lateMin;
        }
        if (isToday) {
          StorageService.setPunchedLocal(todayStr, staffKey, hA);
          UIService.renderPointedBox(hA, todayStr, { hasHP: Boolean(hP || isSec), isLate, lateMin });
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
          if (lateMin <= 10) {
            statusHTML = `
              <div class="histo-status histo-retard-mild">
                <span class="histo-dot" style="background:var(--amber);box-shadow:0 0 6px rgba(245,158,11,.7)"></span>
                <span style="font-weight:900;color:#fff">${hA}</span>
                <span class="histo-retard-badge histo-retard-badge-mild">+${lateMin} min ⏰😐</span>
              </div>`;
          } else {
            statusHTML = `
              <div class="histo-status histo-retard">
                <span class="histo-dot" style="background:var(--red);box-shadow:0 0 6px rgba(239,68,68,.7)"></span>
                <span style="font-weight:900;color:#fff">${hA}</span>
                <span class="histo-retard-badge">+${lateMin} min 😔👎</span>
              </div>`;
          }
        } else {
          statusHTML = `
            <div class="histo-status histo-present">
              <span class="histo-dot" style="background:var(--green);box-shadow:0 0 5px rgba(16,185,129,.6)"></span>
              <span style="font-weight:900">${hA}</span>
              ${(hP || isSec) ? `<span class="histo-ontime-badge">À l'heure 😊👍</span>` : ""}
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
