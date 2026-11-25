// The engine: the shell every mode sits in.
// It owns saving, packs, the voice, the stored libraries and offline behavior.
// The hub and every later mode get these from startEngine() and never go around it.

import { createSaveStore } from './save.js';
import { localStorageAdapter } from './storage-local.js';
import { loadPacks, collectVoiceLines } from './packs.js';
import { createVoice } from './voice.js';
import { loadLibrary, knownLibraries } from './libs.js';
import { startOffline } from './offline.js';

export const ENGINE_VERSION = '0.1.0';

export async function startEngine(options) {
  const settings = options || {};

  const offline = startOffline({ canApplyUpdate: settings.canApplyUpdate });

  const save = createSaveStore({ storage: localStorageAdapter() });
  await save.load();
  if (settings.countOpen !== false) {
    save.app.update(function (app) {
      app.opens = (app.opens || 0) + 1;
      app.last_opened_at = new Date().toISOString();
    });
  }

  const packs = await loadPacks();
  const voice = createVoice();
  voice.setLines(collectVoiceLines(packs.loaded));

  // Ask the device to keep the save even when it is short of space. It may say no.
  let keepAnswer = null;
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(function (answer) { keepAnswer = answer; }).catch(function () {});
    }
  } catch (error) { /* older devices do not have this */ }

  return {
    version: ENGINE_VERSION,
    save: save,
    packs: packs,
    voice: voice,
    libs: { load: loadLibrary, known: knownLibraries },
    offline: offline,
    storageKeepAnswer: function () { return keepAnswer; }
  };
}
