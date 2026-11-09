/**
 * =========================================================================
 * GREY CORNER • MODULE PWA & COMPATIBILITÉ iOS SAFARI
 * Enregistrement Service Worker & Guide d'Installation Écran d'Accueil
 * =========================================================================
 */

const PwaService = (() => {
  let deferredPrompt = null;

  // Détection de l'environnement iOS (iPhone / iPad / iPod)
  function isIos() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  // Détection du mode standalone (déjà lancé depuis l'écran d'accueil comme une app native)
  function isStandalone() {
    return (
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    );
  }

  function init() {
    // 1. Enregistrement du Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker actif. Scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Enregistrement SW non supporté ou échoué:", err);
          });
      });
    }

    const btnInstall = document.getElementById("btnPwaInstall");
    const iosModal = document.getElementById("iosInstallModal");
    const btnCloseIos = document.getElementById("btnCloseIosInstall");

    if (btnCloseIos && iosModal) {
      btnCloseIos.addEventListener("click", () => {
        iosModal.classList.add("hidden");
      });
      iosModal.addEventListener("click", (e) => {
        if (e.target === iosModal) {
          iosModal.classList.add("hidden");
        }
      });
    }

    // Si l'application tourne déjà en mode standalone PWA, ne pas afficher le bouton d'installation
    if (isStandalone()) {
      if (btnInstall) btnInstall.classList.add("hidden");
      return;
    }

    // 2. Gestion spécifique pour iOS Safari
    if (isIos()) {
      if (btnInstall) {
        btnInstall.classList.remove("hidden");
        btnInstall.innerHTML = "📲 Installer sur iPhone (iOS)";
        btnInstall.addEventListener("click", () => {
          if (iosModal) iosModal.classList.remove("hidden");
        });
      }
      return;
    }

    // 3. Gestion pour Android & Chrome / Edge (beforeinstallprompt)
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstall) {
        btnInstall.classList.remove("hidden");
        btnInstall.innerHTML = "📲 Installer l'application";
        btnInstall.addEventListener("click", async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") {
            btnInstall.classList.add("hidden");
          }
          deferredPrompt = null;
        });
      }
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      if (btnInstall) btnInstall.classList.add("hidden");
      console.log("[PWA] Application installée avec succès !");
    });
  }

  return {
    init,
    isIos,
    isStandalone
  };
})();

// Initialisation dès que le DOM est prêt
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => PwaService.init());
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PwaService };
}
