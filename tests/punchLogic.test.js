const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { isExplicitMaladie } = require("../js/config.js");
const { SecurityService, TimeService } = require("../js/services.js");
const { HistoryService } = require("../js/history.js");

describe("Module Logique Métier, Retards & Protection Arrêt Maladie (M)", () => {

  describe("1. Identifiants Collaborateurs (makeEmpId / keyStaff)", () => {
    test("Génération standard et nettoyage des espaces", () => {
      assert.equal(SecurityService.keyStaff("Mokhtar KTAMI"), "MOKHTAR_KTAMI");
      assert.equal(SecurityService.makeEmpId("Mokhtar KTAMI"), "MOKHTAR_KTAMI");
      assert.equal(SecurityService.makeEmpId("  EL AZHARY   NAJIA "), "EL_AZHARY_NAJIA");
      assert.equal(SecurityService.makeEmpId("Saad IDRISSI"), "SAAD_IDRISSI");
      assert.equal(SecurityService.makeEmpId("HAMID ALAOUI ABDELAZIZ"), "HAMID_ALAOUI_ABDELAZIZ");
    });
  });

  describe("2. Calcul des Retards & Seuils de Tolérance", () => {
    test("À l'heure (arrivée anticipée ou exacte) -> 0 min de retard", () => {
      const lateEarly = HistoryService.calculateLateMinutes("07:00", "06:50", "TEST_KEY");
      assert.equal(lateEarly, 0, "Arrivée 10 min avant l'heure ne doit pas générer de retard");

      const lateOnTime = HistoryService.calculateLateMinutes("07:00", "07:00", "TEST_KEY");
      assert.equal(lateOnTime, 0, "Arrivée à l'heure pile est à l'heure");
    });

    test("Léger retard (<= 15 minutes) -> tolérance, aucun motif exigé", () => {
      const lateMild = HistoryService.calculateLateMinutes("07:00", "07:12", "TEST_KEY");
      assert.equal(lateMild, 12, "Le retard calculé doit être de 12 min");
      assert.ok(lateMild <= 15, "Doit être dans le seuil de tolérance (≤ 15 min)");
    });

    test("Retard caractérisé (> 15 minutes) -> déclenchement du modal de justification", () => {
      const lateSevere = HistoryService.calculateLateMinutes("07:00", "07:35", "TEST_KEY");
      assert.equal(lateSevere, 35, "Le retard calculé doit être de 35 min");
      assert.ok(lateSevere > 15, "Doit dépasser 15 min et solliciter un motif auprès du collaborateur");
    });
  });

  describe("3. Protection Arrêt Maladie (M)", () => {
    test("Détection de l'arrêt maladie sous toutes ses formes valides", () => {
      assert.equal(isExplicitMaladie({ maladie: true }), true);
      assert.equal(isExplicitMaladie({ maladie: "true" }), true);
      assert.equal(isExplicitMaladie({ statut: "MALADIE" }), true);
      assert.equal(isExplicitMaladie({ statut: "Arrêt Maladie" }), true);
      assert.equal(isExplicitMaladie({ statut: "arret maladie" }), true);
      assert.equal(isExplicitMaladie({ statut: "M" }), true);
      assert.equal(isExplicitMaladie({ type: "MALADIE" }), true);
      assert.equal(isExplicitMaladie({ motif: "Maladie - Certificat médical 48h" }), true);
    });

    test("Rejet d'un statut non maladie (présence normale, congé, etc.)", () => {
      assert.equal(isExplicitMaladie({ hA: "08:00", retard: false }), false);
      assert.equal(isExplicitMaladie({ statut: "PRESENT" }), false);
      assert.equal(isExplicitMaladie({ off: true }), false);
      assert.equal(isExplicitMaladie(null), false);
      assert.equal(isExplicitMaladie(undefined), false);
      assert.equal(isExplicitMaladie(""), false);
    });

    test("Simulation du verrouillage du pointage en cas d'arrêt maladie RH", () => {
      // Données simulées provenant de presences/{date}/{empId}
      const recordMaladie = {
        empKey: "BENKHADA_ABDESSLAM",
        date: "2026-11-08",
        statut: "MALADIE",
        maladie: true,
        certificatMedical: true
      };

      const isProtected = isExplicitMaladie(recordMaladie);
      assert.equal(isProtected, true, "Le collaborateur doit être identifié en arrêt maladie");

      // La règle métier interdit l'écrasement par un pointage
      let canPunch = true;
      let displayMessage = "";
      if (isProtected) {
        canPunch = false;
        displayMessage = "🩺 Vous êtes déclaré(e) en Arrêt Maladie aujourd'hui. Reposez-vous bien !";
      }

      assert.equal(canPunch, false, "Le pointage doit être formellement bloqué");
      assert.ok(displayMessage.includes("Arrêt Maladie"), "Le message d'information bienveillant doit être formulé");
    });
  });

});
