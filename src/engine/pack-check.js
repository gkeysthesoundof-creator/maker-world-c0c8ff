// Pack checker for Roman's World.
// Pure code: no browser, no storage, no network. The game uses it when it loads a pack,
// and tools/make-precache.mjs uses it before a pack is allowed into the game.
// Every reason it gives is a plain sentence a non-coder can act on.

export const PACK_TYPES = [
  'sight_words', 'counting', 'shop', 'missions', 'coloring_pages', 'puzzles', 'voice_lines'
];

export const EDITIONS = ['original', 'private'];

// The first seven come from kit file 07 section 4.
// button_name and coming_soon were added in order RW-001 (Studio Director ruling).
export const VOICE_MOMENTS = [
  'welcome', 'correct_first', 'correct_second', 'reteach', 'finished_making', 'bought_item', 'goodbye',
  'button_name', 'coming_soon'
];

export const MAX_SPOKEN_LENGTH = 160;

const ID_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isGoodId(value) {
  return typeof value === 'string' && ID_SHAPE.test(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Looks through every piece of text in the pack for a private file name.
function findPrivateFileNames(value, found) {
  if (typeof value === 'string') {
    if (/(^|[^a-z0-9])priv-/i.test(value)) found.push(value);
  } else if (Array.isArray(value)) {
    value.forEach(function (entry) { findPrivateFileNames(entry, found); });
  } else if (isPlainObject(value)) {
    Object.keys(value).forEach(function (key) { findPrivateFileNames(value[key], found); });
  }
  return found;
}

function checkVoiceLine(item, where, reasons) {
  if (VOICE_MOMENTS.indexOf(item.moment) === -1) {
    reasons.push(where + ' has a "moment" the game does not know: "' + item.moment +
      '". Allowed: ' + VOICE_MOMENTS.join(', ') + '.');
  }
  if (typeof item.text !== 'string' || item.text.trim() === '') {
    reasons.push(where + ' has no spoken "text".');
  } else if (item.text.length > MAX_SPOKEN_LENGTH) {
    reasons.push(where + ' has spoken text longer than ' + MAX_SPOKEN_LENGTH +
      ' letters. Spoken lines must be short.');
  }
  if (item.moment === 'button_name') {
    if (!isGoodId(item.target)) {
      reasons.push(where + ' is a button name, so it needs a "target" saying which button it names ' +
        '(lowercase words joined by hyphens, for example "skin-studio").');
    }
  } else if (item.target !== undefined) {
    reasons.push(where + ' has a "target" but only button_name lines may have one.');
  }
}

// Returns { ok, reasons, warnings }. A pack with any reason is not loaded.
export function checkPack(pack, options) {
  const fileName = options && options.fileName;
  const reasons = [];
  const warnings = [];

  if (!isPlainObject(pack)) {
    return { ok: false, reasons: ['The pack is not a single JSON object in curly brackets.'], warnings: warnings };
  }

  if (!isGoodId(pack.pack_id)) {
    reasons.push('"pack_id" is missing or is not lowercase words joined by hyphens.');
  } else if (fileName && fileName !== pack.pack_id + '.json') {
    reasons.push('The file is named "' + fileName + '" but its pack_id is "' + pack.pack_id +
      '". The file must be named "' + pack.pack_id + '.json".');
  }

  if (PACK_TYPES.indexOf(pack.pack_type) === -1) {
    reasons.push('"pack_type" is "' + pack.pack_type + '". Allowed: ' + PACK_TYPES.join(', ') + '.');
  }

  if (!Number.isInteger(pack.version) || pack.version < 1) {
    reasons.push('"version" must be a whole number, 1 or higher.');
  }

  if (EDITIONS.indexOf(pack.edition) === -1) {
    reasons.push('"edition" must be "original" or "private".');
  }

  if (typeof pack.title !== 'string' || pack.title.trim() === '') {
    reasons.push('"title" is missing.');
  }

  if (pack.placeholder !== undefined && typeof pack.placeholder !== 'boolean') {
    reasons.push('"placeholder" must be true or false when it is present.');
  }

  if (!Array.isArray(pack.items)) {
    reasons.push('"items" must be a list in square brackets.');
  } else {
    const seen = {};
    pack.items.forEach(function (item, index) {
      const where = 'Item ' + (index + 1);
      if (!isPlainObject(item)) {
        reasons.push(where + ' is not an object in curly brackets.');
        return;
      }
      if (!isGoodId(item.id)) {
        reasons.push(where + ' has an "id" that is missing or is not lowercase words joined by hyphens.');
      } else if (seen[item.id]) {
        reasons.push('The id "' + item.id + '" is used more than once. Ids are never reused.');
      } else {
        seen[item.id] = true;
      }
      const label = isGoodId(item.id) ? where + ' ("' + item.id + '")' : where;
      if (pack.pack_type === 'voice_lines') checkVoiceLine(item, label, reasons);
    });
    if (pack.pack_type === 'voice_lines' && pack.items.length === 0) {
      reasons.push('A voice pack needs at least one line.');
    }
    if (PACK_TYPES.indexOf(pack.pack_type) !== -1 && pack.pack_type !== 'voice_lines') {
      warnings.push('Items of type "' + pack.pack_type + '" are not checked in detail yet. ' +
        'Only the envelope, the ids and the private file rule were checked.');
    }
  }

  if (pack.edition === 'original') {
    const privateNames = findPrivateFileNames(pack, []);
    if (privateNames.length > 0) {
      reasons.push('This is an original pack but it refers to a private file ("' + privateNames[0] +
        '"). Private files may only be named in a private pack.');
    }
  }

  if (pack.placeholder === true) {
    warnings.push('This pack is marked PLACEHOLDER. It must be replaced before any release.');
  }

  return { ok: reasons.length === 0, reasons: reasons, warnings: warnings };
}
