/**
 * =========================================================================
 * GREY CORNER • APPLICATION DE POINTAGE & PRÉSENCES
 * Fichier de Compatibilité Ascendante
 * =========================================================================
 * Le projet a été refactorisé dans une architecture modulaire propre :
 * - js/config.js    : Configuration & initialisation Firebase
 * - js/services.js  : Services Temps, Sécurité, Photos, Stockage, GPS
 * - js/plannings.js : Plannings fixes (Cuisine, Caisse) & dynamiques (Sheets)
 * - js/ui.js        : Interface utilisateur, Toasts, Supervision Gérant
 * - js/history.js   : Historique 7 jours & mensuel, calcul des retards
 * - js/app.js       : Contrôleur de pointage & Cycle de vie applicatif
 */

(function() {
  if (typeof Config === "undefined") {
    const modules = [
      "js/config.js",
      "js/services.js",
      "js/plannings.js",
      "js/ui.js",
      "js/history.js",
      "js/app.js"
    ];
    modules.forEach(src => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      document.head.appendChild(script);
    });
  }
})();
