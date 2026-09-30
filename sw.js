// Offline cache. Bump VERSION whenever any file below changes so phones pick up the update.
const VERSION = 'wlog-1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/viewer.js', 'js/sheets.js', 'js/store.js', 'js/lib.js', 'js/muscles.js',
  'js/journal.js', 'js/progress.js', 'js/library.js', 'js/settings.js', 'data/exercises.js',
  'assets/body.glb', 'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'vendor/three/three.module.min.js', 'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/controls/OrbitControls.js', 'vendor/three/addons/utils/BufferGeometryUtils.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Cache first (the app is static), falling back to the network.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
