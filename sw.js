/*
 * Офлайн-режим. После первого открытия игра работает без интернета.
 * ВАЖНО: при каждом обновлении игры меняй VERSION — иначе у друзей останется старая версия.
 * Основные файлы кладутся в кэш сразу, спрайты и портреты — по мере загрузки.
 */
const VERSION = 'v2.9.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'style.css', 'dialogues.js', 'game.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала сеть (чтобы друзья получали обновления), без сети — из кэша.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
