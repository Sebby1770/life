const CACHE = "life-v11";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/engine.js",
  "./js/patterns.js",
  "./js/detect.js",
  "./js/challenges.js",
  "./js/daily.js",
  "./js/storage.js",
  "./js/audio.js",
  "./js/renderer.js",
  "./js/input.js",
  "./js/achievements.js",
  "./js/quiz.js",
  "./favicon.svg",
  "./public/hero.jpg",
  "./public/glider.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit)),
  );
});
