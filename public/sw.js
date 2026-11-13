/*
 * Mode hors ligne partiel d'ATUMI (service worker).
 *
 * - Pages de l'espace élève déjà ouvertes (synthèses, cours, quiz corrigés,
 *   réponses du Prof, agenda, emploi du temps, outils) : réseau d'abord, copie
 *   gardée sur l'appareil, relue quand il n'y a pas de connexion.
 * - Fichiers de l'appli (`/_next/static`, noms uniques) : gardés au premier
 *   chargement, pour que les pages gardées restent interactives.
 * - Livres de Ma bibliothèque déjà lus : réseau d'abord (les droits sont
 *   vérifiés en ligne), copie relue hors ligne, jamais en téléchargement.
 * - Images de l'appli (avatar du Prof) : copie relue hors ligne.
 * - Sinon, la page « Pas de connexion » (`/hors-ligne`).
 *
 * Rien n'est envoyé hors ligne : les actions (quiz, Prof NEO, import) passent
 * toujours par le serveur. Les copies sont effacées à la déconnexion
 * (`src/lib/offline.ts`, mêmes noms de caches, vérifiés par les tests).
 */

const VERSION = "v1";
const PAGES_CACHE = "atumi-pages";
const STATIC_CACHE = "atumi-static";
const BOOKS_CACHE = "atumi-livres";
const SHELL_CACHE = "atumi-shell-" + VERSION;
const OFFLINE_URL = "/hors-ligne";

const MAX_PAGES = 60;
const MAX_STATIC = 400;
const MAX_BOOKS = 5;

/** Pages gardées pour la lecture hors ligne (espace connecté, sans admin ni paiement). */
const PAGE_PREFIXES = [
  "/tableau-de-bord",
  "/cours",
  "/quiz",
  "/syntheses",
  "/professeur",
  "/agenda",
  "/emploi-du-temps",
  "/recherche",
  "/bibliotheque",
  "/aide",
];

function isKeptPage(pathname) {
  return PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Page « Pas de connexion » et ses fichiers, gardés dès l'installation. */
async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(match[1]);
  for (const match of html.matchAll(/src="(\/[\w-]+\.(?:svg|png|webp))"/g)) assets.add(match[1]);
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assets].map((url) =>
      fetch(url)
        .then((r) => (r.ok ? statics.put(url, r) : undefined))
        .catch(() => undefined),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("atumi-shell-") && key !== SHELL_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/** Effacement demandé par la page (déconnexion). */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "atumi-effacer") {
    event.waitUntil(Promise.all([caches.delete(PAGES_CACHE), caches.delete(BOOKS_CACHE)]));
  }
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function offlinePage() {
  const cached = await caches.match(OFFLINE_URL);
  return cached || new Response("Pas de connexion / No connection", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);
    const finalPath = response.url ? new URL(response.url).pathname : url.pathname;
    if (finalPath === "/connexion") {
      // Session fermée (inactivité ou déconnexion) : rien ne reste sur l'appareil.
      await Promise.all([caches.delete(PAGES_CACHE), caches.delete(BOOKS_CACHE)]);
    } else if (response.ok && !response.redirected && isKeptPage(url.pathname)) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.delete(url.href);
      await cache.put(url.href, response.clone());
      await trim(PAGES_CACHE, MAX_PAGES);
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    const cached = (await cache.match(url.href)) || (await cache.match(url.href, { ignoreSearch: true }));
    return cached || offlinePage();
  }
}

async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
    trim(STATIC_CACHE, MAX_STATIC);
  }
  return response;
}

/** Images de l'appli (avatar du Prof, sphère) : réseau d'abord, copie hors ligne. */
async function handleImage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: STATIC_CACHE });
    if (cached) return cached;
    throw new Error("hors ligne");
  }
}

async function handleBook(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(BOOKS_CACHE);
      await cache.delete(url.href);
      await cache.put(url.href, response.clone());
      await trim(BOOKS_CACHE, MAX_BOOKS);
    } else if (response.status === 401 || response.status === 403) {
      const cache = await caches.open(BOOKS_CACHE);
      await cache.delete(url.href);
    }
    return response;
  } catch {
    const cached = await caches.match(url.href, { cacheName: BOOKS_CACHE });
    if (cached) return cached;
    throw new Error("hors ligne");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleStatic(request));
    return;
  }
  if (request.destination === "image" && /^\/[\w-]+\.(?:svg|png|webp)$/.test(url.pathname)) {
    event.respondWith(handleImage(request));
    return;
  }
  if (url.pathname.startsWith("/api/bibliotheque/") && !url.searchParams.has("telecharger")) {
    event.respondWith(handleBook(request, url));
  }
  // Le reste (données des pages, actions, API) passe par le réseau : hors ligne,
  // l'appli recharge la page, servie alors depuis la copie gardée.
});
