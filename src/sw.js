// Service worker for Roman's World. It makes the game work with the network off.
//
// At the first load it stores every file named in precache-list.js on the device.
// After that, every file the game asks for is answered from that store.
// The list is made by tools/make-precache.mjs. Its version changes when any game file changes.
//
// Pattern borrowed from Roman's first game (sw.js there), with two changes:
// the file list is generated instead of typed by hand, and files are answered from the
// store first so the game makes no network calls while Roman plays.

importScripts('./precache-list.js');

const LIST = self.RW_PRECACHE;
const PREFIX = 'romans-world-';
const CACHE = PREFIX + LIST.version;
const WANTED = LIST.files.map(function (path) { return new URL(path, self.location.href).href; });
const missed = [];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // "reload" skips the browser's own cache, so the store always gets the real current file.
      return cache.addAll(WANTED.map(function (url) { return new Request(url, { cache: 'reload' }); }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name.indexOf(PREFIX) === 0 && name !== CACHE;
      }).map(function (name) { return caches.delete(name); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function storeKey(requestUrl) {
  const url = new URL(requestUrl);
  let path = url.pathname;
  if (path.charAt(path.length - 1) === '/') path += 'index.html';
  return url.origin + path;
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  // The game never talks to another address. Anything that tries is refused here.
  if (new URL(request.url).origin !== self.location.origin) {
    event.respondWith(Response.error());
    return;
  }

  const key = storeKey(request.url);
  event.respondWith(
    caches.open(CACHE).then(function (cache) { return cache.match(key); }).then(function (stored) {
      if (stored) return stored;
      // Not in the store. This should not happen once the list is complete.
      // Remember it for the tool test page, then try the address the game came from.
      if (missed.indexOf(key) === -1 && missed.length < 50) missed.push(key);
      return fetch(request).catch(function () {
        return new Response('This file is not stored on the device.', { status: 504, statusText: 'Not stored' });
      });
    })
  );
});

self.addEventListener('message', function (event) {
  const type = event.data && event.data.type;
  if (type === 'APPLY_UPDATE') {
    self.skipWaiting();
    return;
  }
  if (type === 'REPORT' && event.ports && event.ports[0]) {
    const port = event.ports[0];
    caches.open(CACHE).then(function (cache) { return cache.keys(); }).then(function (keys) {
      const have = keys.map(function (request) { return request.url; });
      port.postMessage({
        version: LIST.version,
        wanted: WANTED.length,
        stored: have.length,
        missing: WANTED.filter(function (url) { return have.indexOf(url) === -1; }),
        missed: missed.slice()
      });
    }).catch(function () {
      port.postMessage({ version: LIST.version, wanted: WANTED.length, stored: 0, missing: WANTED.slice(), missed: missed.slice() });
    });
  }
});
