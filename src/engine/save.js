// Save store for Roman's World.
// Pure code: it is handed a storage adapter, so it runs the same in the game and in tests.
//
// Promises this file keeps:
// 1. Every save carries a version number (save_version).
// 2. An old save is upgraded step by step, never thrown away. A copy of the old save is kept first.
// 3. A save that cannot be read is set aside under its own name, never deleted.
// 4. A save made by a newer game is left exactly as it is. This session then runs without saving.
// 5. Roman never sees an error. If storage is missing, the game still plays.
//
// Modes never touch storage. They ask for their own drawer with forMode('mode-id').

import { isGoodId } from './pack-check.js';

export const SAVE_KEY = 'romans-world.save';
export const SAVE_VERSION = 1;

// Upgrade steps. The step stored under N turns a version N save into a version N + 1 save.
// When SAVE_VERSION goes up, add the step here and leave every older step in place.
export const UPGRADES = {};

export function freshSave(nowText) {
  return {
    save_version: SAVE_VERSION,
    created_at: nowText,
    updated_at: nowText,
    app: { opens: 0, last_opened_at: null, greetings: 0, last_welcome_id: null },
    modes: {}
  };
}

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createSaveStore(options) {
  const storage = options.storage;
  const now = options.now || function () { return new Date().toISOString(); };
  const currentVersion = options.currentVersion || SAVE_VERSION;
  const upgrades = options.upgrades || UPGRADES;
  const makeFresh = options.makeFresh || freshSave;
  const key = options.key || SAVE_KEY;

  let data = makeFresh(now());
  let saving = true;          // false means: play in memory only, write nothing
  let lastWriteOk = null;
  let status = { state: 'not_loaded', notes: [] };

  function fillGaps() {
    if (!isPlainObject(data.app)) data.app = {};
    if (!isPlainObject(data.modes)) data.modes = {};
    const defaults = makeFresh(now()).app;
    Object.keys(defaults).forEach(function (name) {
      if (data.app[name] === undefined) data.app[name] = defaults[name];
    });
  }

  function persist() {
    if (!saving) return false;
    data.updated_at = now();
    lastWriteOk = storage.write(key, JSON.stringify(data)) === true;
    return lastWriteOk;
  }

  function setAside(label, rawText) {
    const name = key + '.' + label;
    const kept = storage.write(name, rawText) === true;
    return kept ? name : null;
  }

  function load() {
    const notes = [];
    const raw = storage.read(key);

    if (raw === null || raw === undefined || raw === '') {
      data = makeFresh(now());
      saving = true;
      persist();
      status = { state: 'new', notes: notes };
      return status;
    }

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (error) { parsed = null; }

    if (!isPlainObject(parsed) || !Number.isInteger(parsed.save_version) || parsed.save_version < 1) {
      const keptAs = setAside('unreadable.' + now().replace(/[^0-9]/g, ''), raw);
      notes.push(keptAs
        ? 'The save could not be read. It was kept as "' + keptAs + '" and a new save was started.'
        : 'The save could not be read and could not be copied aside, so it was left alone. Playing without saving.');
      data = makeFresh(now());
      saving = keptAs !== null;
      persist();
      status = { state: keptAs ? 'recovered' : 'read_only', notes: notes };
      return status;
    }

    if (parsed.save_version > currentVersion) {
      notes.push('The save is version ' + parsed.save_version + ' but this game only knows version ' +
        currentVersion + '. The save was left untouched. Playing without saving.');
      data = makeFresh(now());
      saving = false;
      status = { state: 'read_only', notes: notes };
      return status;
    }

    if (parsed.save_version < currentVersion) {
      const fromVersion = parsed.save_version;
      const keptAs = setAside('backup.v' + fromVersion, raw);
      let working = copy(parsed);
      let failed = keptAs === null ? 'the old save could not be copied aside first' : null;
      while (!failed && working.save_version < currentVersion) {
        const step = upgrades[working.save_version];
        const before = working.save_version;
        if (typeof step !== 'function') {
          failed = 'there is no upgrade step from version ' + before;
          break;
        }
        try {
          working = step(copy(working));
        } catch (error) {
          failed = 'the upgrade step from version ' + before + ' broke';
          break;
        }
        if (!isPlainObject(working) || working.save_version !== before + 1) {
          failed = 'the upgrade step from version ' + before + ' did not produce version ' + (before + 1);
        }
      }
      if (failed) {
        notes.push('The old save (version ' + fromVersion + ') could not be upgraded because ' + failed +
          '. It was left untouched. Playing without saving.');
        data = makeFresh(now());
        saving = false;
        status = { state: 'read_only', notes: notes };
        return status;
      }
      data = working;
      saving = true;
      fillGaps();
      persist();
      notes.push('The save was upgraded from version ' + fromVersion + ' to version ' + currentVersion +
        '. The old one was kept as "' + keptAs + '".');
      status = { state: 'upgraded', notes: notes };
      return status;
    }

    data = parsed;
    saving = true;
    fillGaps();
    status = { state: 'loaded', notes: notes };
    return status;
  }

  function drawer(read, write) {
    return {
      get: function () { return copy(read()); },
      set: function (value) {
        if (!isPlainObject(value)) throw new Error('A save drawer holds one object.');
        write(copy(value));
        return persist();
      },
      update: function (change) {
        const working = copy(read());
        const result = change(working);
        write(isPlainObject(result) ? copy(result) : working);
        return persist();
      }
    };
  }

  return {
    load: load,
    status: function () {
      return { state: status.state, notes: status.notes.slice(), saving: saving, last_write_ok: lastWriteOk,
        save_version: data.save_version, storage_available: storage.available !== false };
    },
    snapshot: function () { return copy(data); },
    // The shell's own drawer (opens, greetings). Modes do not use this.
    app: drawer(function () { return data.app; }, function (value) { data.app = value; }),
    // One drawer per mode. A mode can only reach its own.
    forMode: function (modeId) {
      if (!isGoodId(modeId)) throw new Error('A mode id is lowercase words joined by hyphens.');
      return drawer(
        function () { return data.modes[modeId] || {}; },
        function (value) { data.modes[modeId] = value; }
      );
    }
  };
}
