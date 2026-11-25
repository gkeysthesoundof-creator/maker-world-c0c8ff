// Loads a library that is stored inside the game. Never from a remote address.
// Modes ask for a library by name. They never write their own script tags.

const LIBRARIES = {
  // Phaser, the 2D game engine. See src/vendor/phaser/VERSION.txt.
  phaser: { file: '../vendor/phaser/phaser.min.js', global: 'Phaser' }
};

const loading = {};

export function knownLibraries() {
  return Object.keys(LIBRARIES);
}

export function loadLibrary(name) {
  const entry = LIBRARIES[name];
  if (!entry) return Promise.reject(new Error('The game has no library called "' + name + '".'));
  if (globalThis[entry.global]) return Promise.resolve(globalThis[entry.global]);
  if (loading[name]) return loading[name];

  const url = new URL(entry.file, import.meta.url);
  if (url.origin !== globalThis.location.origin) {
    return Promise.reject(new Error('Libraries only load from inside the game.'));
  }

  loading[name] = new Promise(function (resolve, reject) {
    const tag = document.createElement('script');
    tag.src = url.href;
    tag.onload = function () {
      if (globalThis[entry.global]) resolve(globalThis[entry.global]);
      else reject(new Error('The library "' + name + '" loaded but did not start.'));
    };
    tag.onerror = function () {
      delete loading[name];
      reject(new Error('The library "' + name + '" could not be loaded from inside the game.'));
    };
    document.head.appendChild(tag);
  });
  return loading[name];
}
