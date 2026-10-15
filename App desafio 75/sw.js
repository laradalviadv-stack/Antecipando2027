// Service worker: funciona offline.
// Arquivos do app: rede primeiro (sempre atualizado quando online), cache como reserva.
// Fontes do Google: cache primeiro.
const VERSION = 'a2027-v3';
const SHELL = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/frases.js', './js/core.js', './js/ui.js', './js/tarefas.js', './js/hoje.js', './js/conclusao.js', './js/progresso.js', './js/registro.js', './js/metricas.js', './js/ajustes.js', './js/app.js',
  './icons/icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => r.ok && c.put(u, r)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'a2027-fonts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('a2027-fonts').then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
