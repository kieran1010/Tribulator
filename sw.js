// sw.js — Tribulator Service Worker
var CACHE_NAME = 'tribulator-v2';
var URLS_TO_CACHE = [
  '/Tribulator/',
  '/Tribulator/index.html',
  '/Tribulator/share.html',
  '/Tribulator/manifest.json',
  '/Tribulator/icon192.png',
  '/Tribulator/icon512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Network first for API calls, cache first for assets
  var url = event.request.url;
  if (url.indexOf('script.google.com') !== -1 ||
      url.indexOf('eutils.ncbi.nlm.nih.gov') !== -1 ||
      url.indexOf('api.anthropic.com') !== -1) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
