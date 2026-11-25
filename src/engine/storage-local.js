// The only file in the game that touches the browser's storage.
// Everything else goes through the save store in save.js.
// tests/unit/guards.test.mjs fails if any other game file touches storage.

export function localStorageAdapter() {
  let box = null;
  try {
    box = globalThis.localStorage || null;
    if (box) {
      const probe = 'romans-world.probe';
      box.setItem(probe, '1');
      box.removeItem(probe);
    }
  } catch (error) {
    box = null;
  }

  return {
    available: box !== null,
    read: function (key) {
      if (!box) return null;
      try { return box.getItem(key); } catch (error) { return null; }
    },
    write: function (key, text) {
      if (!box) return false;
      try { box.setItem(key, text); return true; } catch (error) { return false; }
    },
    keys: function () {
      if (!box) return [];
      const names = [];
      try {
        for (let i = 0; i < box.length; i += 1) names.push(box.key(i));
      } catch (error) { /* storage went away; report what we have */ }
      return names;
    }
  };
}
