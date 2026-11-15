// The Broken Seal Companion - service worker.
// Caches the app shell only. Chat data (the Nakama server: REST + WebSocket)
// is never cached: those requests go to another origin and are passed through.
// Bump VERSION whenever a shell file changes.

const VERSION = "companion-v1";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];
// Pinned third-party shell files (fixed versions, safe to keep).
const PINNED = [
  "https://cdn.jsdelivr.net/npm/@heroiclabs/nakama-js@2.8.0/dist/nakama-js.esm.mjs"
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // Third-party file: best effort, the app still works online without it.
    await Promise.all(PINNED.map((u) => cache.add(new Request(u, { mode: "cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Same-origin shell: network first (fresh deploys show up), cache as fallback offline.
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL("./", self.location).pathname)) return;
    if (url.pathname.endsWith("/config.local.js")) return; // local testing file, never cached
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res.ok && SHELL.some((p) => new URL(p, self.location).pathname === url.pathname)) {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const hit = await cache.match(req, { ignoreSearch: true });
        return hit || cache.match("./index.html");
      }
    })());
    return;
  }

  // Pinned library and fonts: cache first.
  if (PINNED.includes(req.url) || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    })());
  }
  // Everything else (the Nakama server) is not touched.
});
