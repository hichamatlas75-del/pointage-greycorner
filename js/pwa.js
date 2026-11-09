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

  // Détection du mode standalone (déjà installé comme app PWA ou fermé manuellement)
  function isStandalone() {
    // 1. Détection via paramètre URL de démarrage PWA
    const hasPwaParam = window.location.search.includes("mode=pwa");
    if (hasPwaParam) {
      try { localStorage.setItem("gc_pwa_installed", "1"); } catch (e) {}
    }

    // 2. Détection via stockage persistant (déjà installé ou déjà fermé par l'utilisateur)
    try {
      if (localStorage.getItem("gc_pwa_installed") === "1") return true;
      if (localStorage.getItem("gc_pwa_dismissed") === "1") return true;
    } catch (e) {}

    // 3. Détection native WebKit iOS & Android Display Mode
    const isStandaloneMode = (
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      document.referrer.includes("android-app://") ||
      hasPwaParam
    );

    if (isStandaloneMode) {
      try { localStorage.setItem("gc_pwa_installed", "1"); } catch (e) {}
      return true;
    }

    return false;
  }

  function hideBanner() {
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) {
      banner.classList.add("hidden");
      banner.style.display = "none";
    }
  }

  function showBanner() {
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) {
      banner.classList.remove("hidden");
      banner.style.display = "flex";
    }
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

    const banner = document.getElementById("pwaInstallBanner");
    const btnAction = document.getElementById("btnPwaInstallAction");
    const btnDismiss = document.getElementById("btnPwaDismiss");
    const iosModal = document.getElementById("iosInstallModal");
    const btnCloseIos = document.getElementById("btnCloseIosInstall");

    // Écouteur fermeture modal iOS
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

    // Écouteur pour fermer la bannière (l'utilisateur ne sera plus dérangé)
    if (btnDismiss) {
      btnDismiss.addEventListener("click", () => {
        try { localStorage.setItem("gc_pwa_dismissed", "1"); } catch (e) {}
        hideBanner();
      });
    }

    // Si déjà installé ou en mode standalone, ne JAMAIS afficher la bannière
    if (isStandalone()) {
      hideBanner();
      return;
    }

    // 2. Gestion spécifique pour iOS Safari
    if (isIos()) {
      showBanner();
      if (btnAction) {
        btnAction.addEventListener("click", () => {
          if (iosModal) iosModal.classList.remove("hidden");
        });
      }
      return;
    }

    // 3. Gestion pour Android & Chrome / Edge (beforeinstallprompt)
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;

      // Vérifier encore une fois si l'utilisateur l'a fermé
      if (isStandalone()) {
        hideBanner();
        return;
      }

      showBanner();

      if (btnAction) {
        btnAction.addEventListener("click", async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") {
            try { localStorage.setItem("gc_pwa_installed", "1"); } catch (e) {}
            hideBanner();
          }
          deferredPrompt = null;
        });
      }
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      try { localStorage.setItem("gc_pwa_installed", "1"); } catch (e) {}
      hideBanner();
      console.log("[PWA] Application installée avec succès !");
    });
  }

  return {
    init,
    isIos,
    isStandalone,
    hideBanner,
    showBanner
  };
})();

// Initialisation dès que le DOM est prêt
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => PwaService.init());
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PwaService };
}
