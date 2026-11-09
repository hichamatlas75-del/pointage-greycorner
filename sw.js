/**
 * =========================================================================
 * GREY CORNER • SERVICE WORKER (PWA & iOS STANDALONE)
 * Cache Shell, Gestion Hors-Ligne & Neutralisation des Requêtes Temps Réel
 * =========================================================================
 */

const CACHE_NAME = "greycorner-pwa-v1.1.0-theme2";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.css",
  "./css/tailwind-compiled.css",
  "./js/config.js",
  "./js/services.js",
  "./js/plannings.js",
  "./js/ui.js",
  "./js/history.js",
  "./js/advance-service.js",
  "./js/app.js",
  "./images/LOGO%20GREY%20CORNER.png",
  "./images/apple-touch-icon.png",
  "./images/icon-192.png",
  "./images/icon-512.png"
];

// Installation : pré-mise en cache des assets statiques essentiels
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Erreur de pré-cache partielle:", err);
      });
    })
  );
});

// Activation : suppression des anciens caches obsolètes
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes réseau
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NE PAS METTRE EN CACHE : Requêtes Firebase, Google Sheets, Google Apps Script et WebSocket
  if (
    url.hostname.includes("firebasedatabase.app") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("docs.google.com") ||
    url.hostname.includes("script.google.com") ||
    req.method !== "GET"
  ) {
    return; // Laisser passer directement au réseau
  }

  // 2. Stratégie Network-First avec repli sur Cache pour le code applicatif (HTML, JS, CSS)
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const respClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
        }
        return networkResponse;
      })
      .catch(() => {
        // En cas de panne réseau ou mode hors-ligne, servir depuis le cache
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});
