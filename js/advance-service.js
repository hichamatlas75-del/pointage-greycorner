// =============================================================
// js/advance-service.js — Service de Demande d'Avance sur Salaire
// Synchronisation temps réel avec PAIE GREY CORNER via Firebase RTDB
// =============================================================
"use strict";

const AdvanceService = {
  // Mode test temporaire : true = ouvre les demandes même hors de la période du 2 au 15
  TEST_FORCE_OPEN: true,

  _empKey: null,
  _nomComplet: null,
  _cin: null,
  _monthKey: null,
  _listenerRef: null,
  _listenerCallback: null,
  _currentRequests: [],
  _isSubmitting: false,

  /**
   * Échappement XSS sécurisé pour toutes les chaînes injectées dans le DOM
   * @param {*} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (typeof UIService !== "undefined" && typeof UIService.escapeHtml === "function") {
      return UIService.escapeHtml(str);
    }
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Retourne la date serveur sécurisée via TimeService
   * @returns {Date}
   */
  getTrustedDate() {
    if (typeof TimeService !== "undefined" && typeof TimeService.getTrustedDate === "function") {
      return TimeService.getTrustedDate();
    }
    return new Date();
  },

  /**
   * Retourne le jour du mois basé impérativement sur l'heure serveur sécurisée
   * @returns {number} 1..31
   */
  getTrustedDayOfMonth() {
    return this.getTrustedDate().getDate();
  },

  /**
   * Vérifie si la période de demande est ouverte (du 2 au 15 inclus, ou forcée en mode test)
   * @returns {boolean}
   */
  isRequestWindowOpen() {
    if (this.TEST_FORCE_OPEN) return true;
    const jour = this.getTrustedDayOfMonth();
    return jour >= 2 && jour <= 15;
  },

  /**
   * Calcule le message discret indiquant la prochaine date d'ouverture
   * @returns {string}
   */
  getNextOpeningMessage() {
    const trustedDate = this.getTrustedDate();
    const jour = trustedDate.getDate();
    const moisNoms = [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ];

    if (jour < 2) {
      const moisActuel = moisNoms[trustedDate.getMonth()];
      return `Prochaine ouverture : le 2 ${moisActuel} (jusqu'au 15 ${moisActuel}).`;
    } else {
      const nextMonthIndex = (trustedDate.getMonth() + 1) % 12;
      const nextYear = trustedDate.getMonth() === 11 ? trustedDate.getFullYear() + 1 : trustedDate.getFullYear();
      return `Prochaine ouverture : le 2 ${moisNoms[nextMonthIndex]} ${nextYear}.`;
    }
  },

  /**
   * Retourne le mois courant au format "YYYY-MM" basé sur l'heure serveur
   * @returns {string}
   */
  getCurrentMonthKey() {
    if (typeof TimeService !== "undefined" && typeof TimeService.currentDateStr === "function") {
      return TimeService.currentDateStr().slice(0, 7);
    }
    const d = this.getTrustedDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  },

  /**
   * Formate une date ISO ou YYYY-MM-DD en JJ/MM/AAAA
   * @param {string|number} val
   * @returns {string}
   */
  formatDisplayDate(val) {
    if (!val) return "";
    if (typeof val === "number") {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
      }
    }
    const str = String(val).trim();
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return str;
  },

  /**
   * Initialise les écouteurs DOM de la modale d'avance
   */
  init() {
    const btnOpen = document.getElementById("btnOpenAdvanceModal");
    const btnCancel = document.getElementById("btnCancelAdvance");
    const btnSubmit = document.getElementById("btnConfirmAdvance");
    const modal = document.getElementById("advanceModal");
    const amountInput = document.getElementById("advanceAmountInput");
    const quickBtns = document.querySelectorAll(".advance-quick-btn");

    if (btnOpen) {
      btnOpen.addEventListener("click", () => this.openModal());
    }

    if (btnCancel) {
      btnCancel.addEventListener("click", () => this.closeModal());
    }

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) this.closeModal();
      });
    }

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-amount");
        if (amountInput && val) {
          amountInput.value = val;
          quickBtns.forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          const errEl = document.getElementById("advanceFormError");
          if (errEl) errEl.style.display = "none";
        }
      });
    });

    if (amountInput) {
      amountInput.addEventListener("input", () => {
        const currentVal = String(amountInput.value).trim();
        quickBtns.forEach((b) => {
          b.classList.toggle("selected", b.getAttribute("data-amount") === currentVal);
        });
        const errEl = document.getElementById("advanceFormError");
        if (errEl) errEl.style.display = "none";
      });
    }

    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => this.submitAdvance());
    }

    this.updateButtonState();
  },

  /**
   * Associe le collaborateur actif et démarre l'écoute temps réel Firebase
   * @param {string} empKey - ex: "FILALI_ABDERAFI"
   * @param {string} nomComplet - ex: "FILALI ABDERAFI"
   * @param {Object} [staffObj] - Objet employé optionnel
   */
  bindEmployee(empKey, nomComplet, staffObj = null) {
    this.detachListener();

    this._empKey = empKey;
    this._nomComplet = nomComplet;
    this._cin = (staffObj && staffObj.cin) ? String(staffObj.cin).trim().toUpperCase() : null;
    this._monthKey = this.getCurrentMonthKey();

    const section = document.getElementById("advanceActionContainer");
    if (section) {
      section.style.display = "block";
    }

    this.updateButtonState();
    this.startRealtimeListener();
  },

  /**
   * Détache l'écouteur temps réel Firebase
   */
  detachListener() {
    if (this._listenerRef && this._listenerCallback) {
      this._listenerRef.off("value", this._listenerCallback);
    }
    this._listenerRef = null;
    this._listenerCallback = null;
    this._currentRequests = [];
  },

  /**
   * Écoute en temps réel les demandes d'avances du mois pour le collaborateur
   */
  startRealtimeListener() {
    if (!this._empKey || typeof db === "undefined") return;

    const monthKey = this.getCurrentMonthKey();
    this._monthKey = monthKey;
    const ref = db.ref(`avances/${monthKey}`);
    this._listenerRef = ref;

    this._listenerCallback = (snapshot) => {
      const data = snapshot.val() || {};
      const myRequests = [];

      Object.keys(data).forEach((demandeId) => {
        const item = data[demandeId];
        if (item && item.empKey === this._empKey) {
          myRequests.push({
            id: demandeId,
            ...item
          });
        }
      });

      // Tri du plus récent au plus ancien
      myRequests.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
      this._currentRequests = myRequests;

      this.renderStatusBadge();
      this.updateButtonState();
    };

    ref.on("value", this._listenerCallback, (err) => {
      console.warn("[AdvanceService] Erreur lecture avances:", err.message);
    });
  },

  /**
   * Vérifie si le collaborateur a déjà une demande EN_ATTENTE sur le mois actif
   * @returns {Object|null}
   */
  getPendingRequest() {
    return this._currentRequests.find((r) => r.statut === "EN_ATTENTE") || null;
  },

  /**
   * Vérifie si le collaborateur a déjà une avance VALIDEE (accordée) sur le mois actif
   * @returns {Object|null}
   */
  getValidatedRequest() {
    return this._currentRequests.find((r) => r.statut === "VALIDEE") || null;
  },

  /**
   * Met à jour l'état visuel du bouton et du message d'ouverture (règle du 2 au 15 inclus + 1 seule avance accordée/mois)
   */
  updateButtonState() {
    const btn = document.getElementById("btnOpenAdvanceModal");
    const hint = document.getElementById("advanceWindowHint");
    if (!btn) return;

    const windowOpen = this.isRequestWindowOpen();
    const pendingReq = this.getPendingRequest();
    const validatedReq = this.getValidatedRequest();

    // 1. Si une avance a déjà été accordée (VALIDEE) ce mois-ci : bouton grisé et bloqué jusqu'au mois prochain
    if (validatedReq) {
      btn.disabled = true;
      btn.classList.remove("advance-btn-active");
      btn.classList.add("advance-btn-locked");
      btn.innerHTML = `🔒 Avance déjà accordée pour ce mois`;
      if (hint) {
        hint.textContent = `ℹ️ Une seule avance est autorisée par mois. Prochaine demande possible le mois prochain.`;
        hint.style.display = "block";
      }
      return;
    }

    // 2. Si une demande est en cours de validation (EN_ATTENTE) : bouton grisé
    if (pendingReq) {
      btn.disabled = true;
      btn.classList.remove("advance-btn-active");
      btn.classList.add("advance-btn-locked");
      btn.innerHTML = `⏳ Demande d'avance en cours de validation`;
      if (hint) {
        hint.textContent = `Une demande est déjà en attente de traitement pour ce mois.`;
        hint.style.display = "block";
      }
      return;
    }

    // 3. Si hors période (du 16 au 1er du mois suivant) : bouton grisé
    if (!windowOpen) {
      btn.disabled = true;
      btn.classList.remove("advance-btn-active");
      btn.classList.add("advance-btn-locked");
      btn.innerHTML = `🔒 Demandes closes (ouvertes du 2 au 15)`;

      if (hint) {
        hint.textContent = `ℹ️ ${this.getNextOpeningMessage()}`;
        hint.style.display = "block";
      }
      return;
    }

    // 4. Période ouverte et aucune demande en cours ni validée
    btn.disabled = false;
    btn.classList.remove("advance-btn-locked");
    btn.classList.add("advance-btn-active");
    btn.innerHTML = `💰 Demander une avance sur salaire`;
    if (hint) {
      hint.style.display = "none";
    }
  },

  /**
   * Affiche les badges de statut sous le profil du collaborateur
   */
  renderStatusBadge() {
    const container = document.getElementById("advanceStatusBadge");
    if (!container) return;

    if (!this._currentRequests || this._currentRequests.length === 0) {
      container.style.display = "none";
      container.innerHTML = "";
      return;
    }

    const badgesHtml = [];

    // 1. Demandes en attente
    const pendingList = this._currentRequests.filter((r) => r.statut === "EN_ATTENTE");
    pendingList.forEach((req) => {
      const montantStr = this.escapeHtml(Number(req.montant || 0).toLocaleString("fr-FR"));
      badgesHtml.push(`
        <div class="advance-profile-badge badge-pending">
          <span class="advance-badge-icon">⏳</span>
          <span class="advance-badge-text">Demande de <strong>${montantStr} DH</strong> en cours de validation</span>
        </div>
      `);
    });

    // 2. Demandes validées ce mois-ci
    const validatedList = this._currentRequests.filter((r) => r.statut === "VALIDEE");
    validatedList.forEach((req) => {
      const montantStr = this.escapeHtml(Number(req.montant || 0).toLocaleString("fr-FR"));
      const dateStr = this.escapeHtml(this.formatDisplayDate(req.traiteLe || req.dateDemande));
      const modeLabel = req.modePaiement === "VIREMENT" ? " par Virement" : (req.modePaiement === "ESPECE" ? " en Espèces" : "");
      badgesHtml.push(`
        <div class="advance-profile-badge badge-validated">
          <span class="advance-badge-icon">✅</span>
          <span class="advance-badge-text">Avance de <strong>${montantStr} DH</strong> accordée le ${dateStr}${this.escapeHtml(modeLabel)}</span>
        </div>
      `);
    });

    // 3. Dernière demande refusée (si aucune en attente ni validée plus récente)
    if (pendingList.length === 0 && validatedList.length === 0) {
      const latestRefused = this._currentRequests.find((r) => r.statut === "REFUSEE");
      if (latestRefused) {
        const montantStr = this.escapeHtml(Number(latestRefused.montant || 0).toLocaleString("fr-FR"));
        const dateStr = this.escapeHtml(this.formatDisplayDate(latestRefused.traiteLe || latestRefused.dateDemande));
        badgesHtml.push(`
          <div class="advance-profile-badge badge-refused">
            <span class="advance-badge-icon">❌</span>
            <span class="advance-badge-text">Demande de <strong>${montantStr} DH</strong> refusée le ${dateStr}</span>
          </div>
        `);
      }
    }

    if (badgesHtml.length > 0) {
      container.innerHTML = badgesHtml.join("");
      container.style.display = "flex";
    } else {
      container.innerHTML = "";
      container.style.display = "none";
    }
  },

  /**
   * Ouvre la modale de demande d'avance après contrôle de la fenêtre (2 au 15) et d'absence d'avance déjà accordée
   */
  openModal() {
    if (this.getValidatedRequest()) {
      this.updateButtonState();
      if (typeof UIService !== "undefined") {
        UIService.showPopup(
          "🔒",
          "Avance déjà accordée",
          "Vous avez déjà bénéficié d'une avance sur salaire ce mois-ci. Une nouvelle demande ne sera possible que le mois prochain."
        );
      }
      return;
    }

    if (this.getPendingRequest()) {
      this.updateButtonState();
      if (typeof UIService !== "undefined") {
        UIService.showPopup(
          "⏳",
          "Demande déjà en cours",
          "Vous avez déjà une demande d'avance en attente de validation pour ce mois."
        );
      }
      return;
    }

    const jour = TimeService.getTrustedDate().getDate();
    if (!this.TEST_FORCE_OPEN && (jour < 2 || jour > 15)) {
      this.updateButtonState();
      if (typeof UIService !== "undefined") {
        UIService.showPopup(
          "🔒",
          "Demandes closes",
          `Les demandes d'avances sont autorisées uniquement entre le 2 et le 15 de chaque mois.\n${this.getNextOpeningMessage()}`
        );
      }
      return;
    }

    const modal = document.getElementById("advanceModal");
    const empNameEl = document.getElementById("advanceModalEmpName");
    const amountInput = document.getElementById("advanceAmountInput");
    const motifInput = document.getElementById("advanceMotifInput");
    const errEl = document.getElementById("advanceFormError");
    const quickBtns = document.querySelectorAll(".advance-quick-btn");

    if (empNameEl) empNameEl.textContent = this._nomComplet || "Collaborateur";
    if (amountInput) amountInput.value = "";
    if (motifInput) motifInput.value = "";
    if (errEl) {
      errEl.textContent = "";
      errEl.style.display = "none";
    }
    quickBtns.forEach((b) => b.classList.remove("selected"));

    if (modal) {
      modal.classList.add("show");
    }
  },

  /**
   * Ferme la modale de demande d'avance
   */
  closeModal() {
    const modal = document.getElementById("advanceModal");
    if (modal) {
      modal.classList.remove("show");
    }
  },

  /**
   * Affiche un message d'erreur dans la modale
   * @param {string} msg
   */
  _showFormError(msg) {
    const errEl = document.getElementById("advanceFormError");
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = "block";
    }
  },

  /**
   * Envoie la demande d'avance dans Firebase Realtime Database (avances/{YYYY-MM}/{demandeId})
   */
  async submitAdvance() {
    if (this._isSubmitting) return;

    // 1. SÉCURITÉ ANTI-FRAUDE : Vérification stricte via TimeService.getTrustedDate().getDate()
    const jour = TimeService.getTrustedDate().getDate();
    if (!this.TEST_FORCE_OPEN && (jour < 2 || jour > 15)) {
      this._showFormError("🔒 Période fermée : les demandes sont autorisées uniquement du 2 au 15 du mois.");
      this.updateButtonState();
      setTimeout(() => this.closeModal(), 1400);
      return;
    }

    if (!this._empKey || !this._nomComplet) {
      this._showFormError("Aucun collaborateur sélectionné.");
      return;
    }

    // 2. Empêcher toute nouvelle demande si une avance est déjà EN_ATTENTE ou VALIDEE ce mois-ci
    if (this.getValidatedRequest()) {
      this._showFormError("🔒 Vous avez déjà obtenu une avance sur salaire ce mois-ci.");
      this.updateButtonState();
      setTimeout(() => this.closeModal(), 1400);
      return;
    }

    if (this.getPendingRequest()) {
      this._showFormError("Une demande d'avance est déjà en attente pour ce mois.");
      return;
    }

    const amountInput = document.getElementById("advanceAmountInput");
    const motifInput = document.getElementById("advanceMotifInput");
    const btnConfirm = document.getElementById("btnConfirmAdvance");

    const montant = Number(amountInput ? amountInput.value : 0);
    if (!Number.isFinite(montant) || montant < 50) {
      this._showFormError("Veuillez saisir un montant valide (minimum 50 DH).");
      return;
    }
    if (montant > 30000) {
      this._showFormError("Le montant saisi dépasse le plafond autorisé.");
      return;
    }

    const motifRaw = motifInput ? motifInput.value.trim() : "";
    const motifClean = motifRaw ? motifRaw.slice(0, 200) : "";

    this._isSubmitting = true;
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.textContent = "Envoi en cours...";
    }

    try {
      const monthKey = this.getCurrentMonthKey();
      const dateDemande = typeof TimeService !== "undefined" && typeof TimeService.currentDateStr === "function"
        ? TimeService.currentDateStr()
        : new Date().toISOString().slice(0, 10);

      // Vérification serveur anti-doublon avant écriture (bloque si EN_ATTENTE ou VALIDEE existe déjà)
      const snap = await db.ref(`avances/${monthKey}`).once("value");
      const existingData = snap.val() || {};
      const alreadyActiveOrGranted = Object.values(existingData).some(
        (r) => r && r.empKey === this._empKey && (r.statut === "EN_ATTENTE" || r.statut === "VALIDEE")
      );

      if (alreadyActiveOrGranted) {
        this._showFormError("🔒 Une avance a déjà été accordée ou est en cours de validation pour ce mois.");
        this.updateButtonState();
        return;
      }

      const payload = {
        empKey: this._empKey,
        nomComplet: this._nomComplet,
        cin: this._cin || null,
        montant: Math.round(montant),
        motif: motifClean || null,
        dateDemande: dateDemande,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        statut: "EN_ATTENTE",
        modePaiement: null,
        traiteLe: null
      };

      await db.ref(`avances/${monthKey}`).push(payload);

      this.closeModal();
      if (typeof UIService !== "undefined") {
        UIService.showPopup(
          "✅",
          "Demande envoyée",
          `Votre demande d'avance de ${Math.round(montant).toLocaleString("fr-FR")} DH a été transmise à la direction.`
        );
      }
    } catch (err) {
      console.error("[AdvanceService] Erreur lors de l'envoi:", err);
      this._showFormError("Erreur réseau lors de l'envoi. Veuillez réessayer.");
    } finally {
      this._isSubmitting = false;
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Confirmer la demande";
      }
    }
  }
};
