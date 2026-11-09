const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { Config } = require("../js/config.js");
const { GpsService } = require("../js/services.js");

describe("Module GPS & Géofencing Grey Corner (60 mètres)", () => {
  const cafeLat = Config.geo.cafeLat; // 34.0343959
  const cafeLon = Config.geo.cafeLon; // -5.0155941

  test("1. Calcul de distance Haversine : 0 mètre sur le point exact", () => {
    const dist = GpsService.getDistanceMeters(cafeLat, cafeLon, cafeLat, cafeLon);
    assert.equal(Math.round(dist), 0, "La distance entre le café et lui-même doit être de 0m");
  });

  test("2. Validation dans le rayon strict de 60 mètres (Présence sur place / Terrasse)", () => {
    // Déplacement de ~0.0002 degré en latitude (~22 mètres)
    const posInside = {
      coords: {
        latitude: cafeLat + 0.00020,
        longitude: cafeLon + 0.00010,
        accuracy: 15
      }
    };
    const res = GpsService.evaluatePosition(posInside);
    assert.equal(res.ok, true, "La position à ~25m doit être acceptée");
    assert.equal(res.canPunch, true, "Le collaborateur doit pouvoir pointer");
    assert.equal(res.state, "ok");
    assert.ok(res.text.includes("Position validée"), "Le message doit confirmer la validation");
  });

  test("3. Rejet hors zone (> 60 mètres)", () => {
    // Déplacement de ~0.001 degré (~110 mètres)
    const posOutside = {
      coords: {
        latitude: cafeLat + 0.00100,
        longitude: cafeLon,
        accuracy: 15
      }
    };
    const res = GpsService.evaluatePosition(posOutside);
    assert.equal(res.ok, false, "La position hors zone doit être refusée");
    assert.equal(res.canPunch, false, "Le pointage doit être bloqué hors zone");
    assert.equal(res.state, "bad");
    assert.ok(res.text.includes("Hors zone"), "Le message doit signaler le hors zone");
    assert.ok(res.position.distance > 60, "La distance calculée doit être supérieure à 60m");
  });

  test("4. Rejet d'un signal GPS imprécis (accuracy > 40 mètres)", () => {
    // Position géographiquement proche mais signal 4G imprécis (accuracy 55m)
    const posInaccurate = {
      coords: {
        latitude: cafeLat + 0.00010,
        longitude: cafeLon,
        accuracy: 55
      }
    };
    const res = GpsService.evaluatePosition(posInaccurate);
    assert.equal(res.ok, false, "Un signal imprécis doit être refusé");
    assert.equal(res.canPunch, false, "Le pointage doit être désactivé si signal > 40m");
    assert.ok(res.text.includes("Signal GPS imprécis"), "Le message doit demander de sortir à ciel ouvert");
  });

  test("5. Rejet d'une position simulée (Fake GPS / Mock Location)", () => {
    // A. Accuracy 0m (impossible sur hardware GPS physique)
    const posFakeAcc = {
      coords: {
        latitude: cafeLat + 0.00010,
        longitude: cafeLon,
        accuracy: 0
      }
    };
    const resFake1 = GpsService.evaluatePosition(posFakeAcc);
    assert.equal(resFake1.ok, false, "Accuracy 0 doit être rejetée pour fake");
    assert.ok(resFake1.text.includes("Fake GPS"));

    // B. Coordonnées collées artificiellement au micro-degré théorique
    const posExactMock = {
      coords: {
        latitude: cafeLat,
        longitude: cafeLon,
        accuracy: 5
      }
    };
    const resFake2 = GpsService.evaluatePosition(posExactMock);
    assert.equal(resFake2.ok, false, "Position exacte simulée doit être bloquée");
    assert.ok(resFake2.text.includes("Fake GPS"));
  });
});
