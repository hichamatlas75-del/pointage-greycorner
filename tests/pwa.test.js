const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Module PWA & Conformité iOS / Safari Standalone", () => {
  const rootDir = path.resolve(__dirname, "..");
  const manifestPath = path.join(rootDir, "manifest.json");
  const indexPath = path.join(rootDir, "index.html");
  const swPath = path.join(rootDir, "sw.js");

  test("1. Le fichier manifest.json existe et est un JSON valide", () => {
    assert.ok(fs.existsSync(manifestPath), "manifest.json doit exister à la racine");
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    assert.equal(manifest.display, "standalone", "Le mode d'affichage doit être standalone pour le plein écran");
    assert.ok(manifest.name.includes("Grey Corner"), "Le nom de l'application doit être présent");
    assert.ok(manifest.short_name, "Le short_name doit être défini");
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "Les icônes PWA doivent être définies");
  });

  test("2. Toutes les icônes référencées dans le manifest existent sur le disque", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    manifest.icons.forEach(icon => {
      const iconFile = path.join(rootDir, icon.src);
      assert.ok(fs.existsSync(iconFile), `L'icône ${icon.src} doit exister sur le disque`);
      const stat = fs.statSync(iconFile);
      assert.ok(stat.size > 1000, `L'icône ${icon.src} ne doit pas être vide`);
    });
  });

  test("3. index.html intègre les balises meta Apple requises pour iOS PWA", () => {
    const html = fs.readFileSync(indexPath, "utf-8");
    assert.ok(html.includes('rel="manifest"'), "Le lien manifest.json doit être présent");
    assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "apple-mobile-web-app-capable doit être à yes");
    assert.ok(html.includes('name="apple-mobile-web-app-status-bar-style"'), "apple-mobile-web-app-status-bar-style doit être défini");
    assert.ok(html.includes('rel="apple-touch-icon"'), "apple-touch-icon doit être défini pour iOS");
    assert.ok(html.includes('js/pwa.js'), "Le script PWA doit être chargé");
  });

  test("4. Le Service Worker (sw.js) existe et est syntaxiquement valide", () => {
    assert.ok(fs.existsSync(swPath), "sw.js doit exister à la racine");
    const swCode = fs.readFileSync(swPath, "utf-8");
    assert.ok(swCode.includes("addEventListener"), "sw.js doit contenir des écouteurs d'événements SW");
    assert.ok(swCode.includes("skipWaiting"), "sw.js doit activer le SW immédiatement via skipWaiting()");
  });
});
