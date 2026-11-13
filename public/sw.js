const CACHE = "aoc-review-2026-11-v5";
const CORE = [
  "/",
  "/index.html",
  "/daily.html",
  "/monthly.html",
  "/report.html",
  "/employer.html",
  "/guide.html",
  "/css/style.css",
  "/js/app.js",
  "/js/auth.js",
  "/js/firebase-config.js",
  "/js/ui.js",
  "/js/timeutil.js",
  "/js/theme.js",
  "/js/i18n.js",
  "/js/i18n.json",
  "/js/daily.js",
  "/js/monthly.js",
  "/vendor/jspdf.umd.min.js",
  "/vendor/jspdf.plugin.autotable.min.js",
  "/vendor/exceljs.min.js",
  "/js/report.js",
  "/js/report-utils.mjs",
  "/js/employer.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("aoc-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Le richieste dati/auth Firebase non vengono conservate dal service worker.
  if (url.pathname.startsWith("/__/")) return;
  if (!["navigate", "same-origin", "cors"].includes(request.mode)) return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request, { cache: "no-cache" });
        if (
          response.ok &&
          response.type === "basic" &&
          !url.pathname.startsWith("/__/")
        ) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await caches.match("/index.html");
          if (home) return home;
        }
        return Response.error(); // Mai consegnare HTML al posto di un file JS/CSS.
      }
    })(),
  );
});
