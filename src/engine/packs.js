// Pack loader. Reads the list of packs, fetches each one from inside the game,
// runs the checker, and keeps only packs that pass.
// A pack that fails is skipped with a plain reason. The game keeps running without it.

import { checkPack } from './pack-check.js';

export const PACKS_INDEX_URL = new URL('../../content/packs/packs-index.json', import.meta.url);

async function readJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error('could not be opened (answer ' + response.status + ')');
  return response.json();
}

export async function loadPacks(indexUrl) {
  const base = indexUrl || PACKS_INDEX_URL;
  const result = { loaded: [], rejected: [], warnings: [] };

  let index = null;
  try {
    index = await readJson(base);
  } catch (error) {
    result.rejected.push({ file: 'packs-index.json', reasons: ['The list of packs ' + error.message + '.'] });
    return result;
  }

  const entries = index && Array.isArray(index.packs) ? index.packs : [];
  for (let i = 0; i < entries.length; i += 1) {
    const file = entries[i] && entries[i].file;
    if (typeof file !== 'string' || !/^[a-z0-9-]+\.json$/.test(file)) {
      result.rejected.push({ file: String(file), reasons: ['The list of packs names a file the game will not open.'] });
      continue;
    }
    try {
      const pack = await readJson(new URL(file, base));
      const verdict = checkPack(pack, { fileName: file });
      if (verdict.ok) {
        result.loaded.push(pack);
        verdict.warnings.forEach(function (text) { result.warnings.push({ file: file, text: text }); });
      } else {
        result.rejected.push({ file: file, reasons: verdict.reasons });
      }
    } catch (error) {
      result.rejected.push({ file: file, reasons: ['The pack ' + error.message + '.'] });
    }
  }
  return result;
}

// Gathers every spoken line from the loaded voice packs, in load order.
export function collectVoiceLines(packs) {
  const lines = [];
  packs.forEach(function (pack) {
    if (pack.pack_type !== 'voice_lines') return;
    pack.items.forEach(function (item) {
      lines.push({ id: item.id, moment: item.moment, target: item.target || null, text: item.text, pack_id: pack.pack_id });
    });
  });
  return lines;
}
