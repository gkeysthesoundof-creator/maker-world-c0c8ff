// Spoken voice for Roman's World. Uses the device's built-in voices.
// Every word it says comes from a voice pack. There is no spoken text in this file.
//
// Rules it keeps (spec RW-001, section 3):
// - Newest touch wins. A new line cuts off the one that is playing. Lines never stack up.
// - Nothing waits for a line to finish. If the voice is missing or silent, the game carries on.
//
// Law 3 (no network calls while Roman plays). This fails closed:
// - It only ever speaks with a voice the device plainly reports as living on the device
//   (localService is exactly true). A voice that does not say where it lives is treated
//   as needing the network and is never used.
// - It never speaks with the device's default voice, because a default can need the network.
// - If no on-device English voice is known when a line is asked for, that line is not spoken.
//   The screen still answers the touch.
//
// The idea of ranking the device voices comes from Roman's first game (src/voice.js there).

const RATE = 0.92;   // a little slower than normal, as in the first game
const PITCH = 1.04;

// A device hands over its list of voices a moment after it is first asked, and it can arrive
// in pieces (desktop Chrome lists its network voices first and its on-device voices about a
// second later). A line asked for while no on-device English voice is known waits this long
// for one to appear, then is dropped. Nothing on screen waits, and no touch is held up.
const LIST_WAIT_MS = 2000;
const LIST_CHECK_EVERY_MS = 100;
// A first press may be held. The greeting is still asked for when the finger lifts.
const LIFT_LIMIT_MS = 10000;
// A tap completes just after its finger lifts.
const TAP_AFTER_LIFT_MS = 1000;

// Ask for the list as early as possible, the moment this file loads.
try { if (globalThis.speechSynthesis) globalThis.speechSynthesis.getVoices(); } catch (error) { /* asked again later */ }

// Only a plain "yes" counts. Missing, undefined, null or anything else means "not on the device".
function isOnDevice(voice) {
  return Boolean(voice) && voice.localService === true;
}

function isEnglish(voice) {
  return /^en/i.test(voice.lang || '');
}

// Higher is warmer. This only puts voices in order. It never rules a voice out.
function voiceScore(voice) {
  const name = String(voice.name || '').toLowerCase();
  let score = 0;
  if (/premium/.test(name)) score += 120;
  if (/enhanced/.test(name)) score += 110;
  if (/natural|neural/.test(name)) score += 100;
  if (/siri/.test(name)) score += 90;
  if (/google/.test(name)) score += 60;
  if (/ava|samantha|zoe|allison|susan|joelle|aria|jenny|karen|moira|serena/.test(name)) score += 40;
  if (/^en-US/i.test(voice.lang)) score += 15;
  if (/compact/.test(name)) score -= 60;
  if (/fred|albert|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|kathy|ralph|good news|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/.test(name)) score -= 200;
  return score;
}

// The best English voice that lives on the device, whatever its score.
// Returns nothing when the list has no such voice. It never returns a voice that needs the
// network, or one that does not say where it lives.
export function pickVoice(voices) {
  let best = null;
  let bestScore = -Infinity;
  (voices || []).forEach(function (voice) {
    if (!isOnDevice(voice) || !isEnglish(voice)) return;
    const score = voiceScore(voice);
    if (score > bestScore) { best = voice; bestScore = score; }
  });
  return best;
}

export function createVoice(options) {
  const scope = (options && options.scope) || globalThis;
  const synth = scope.speechSynthesis || null;
  const Utterance = scope.SpeechSynthesisUtterance || null;
  const available = Boolean(synth && Utterance);
  // Tests hand in their own clock so they do not have to wait.
  const clock = (options && options.clock) || {
    now: function () { return Date.now(); },
    set: function (run, ms) { return setTimeout(run, ms); },
    clear: function (id) { clearTimeout(id); }
  };

  let lines = [];
  let unlocked = false;       // true once the device has really started speaking a line
  let current = null;         // the newest request, kept until the device starts it
  let token = 0;
  let listTimer = null;
  const heard = [];           // short history, for the tool test page

  function voiceList() {
    if (!available) return [];
    try { return synth.getVoices() || []; } catch (error) { return []; }
  }

  function chosenVoice() {
    return pickVoice(voiceList());
  }

  function deviceHasTheLine() {
    try { return Boolean(synth.speaking || synth.pending); } catch (error) { return false; }
  }

  function stopListWait() {
    if (listTimer !== null) { clock.clear(listTimer); listTimer = null; }
  }

  function stop() {
    token += 1;
    current = null;
    stopListWait();
    if (!available) return;
    try { synth.cancel(); } catch (error) { /* nothing to stop */ }
  }

  // Hands the lines to the device. Returns false, and speaks nothing, when no on-device
  // voice is known. There is no fall back to the device's default voice.
  function speakNow(parts, mine) {
    try {
      if (deviceHasTheLine()) synth.cancel();
      const voice = chosenVoice();
      if (!voice) return false;
      if (synth.paused) synth.resume();
      parts.forEach(function (line, index) {
        const utterance = new Utterance(line.text);
        utterance.voice = voice;
        utterance.lang = voice.lang || 'en-US';
        utterance.rate = RATE;
        utterance.pitch = PITCH;
        utterance.volume = 1;
        if (index === 0) {
          utterance.onstart = function () {
            unlocked = true;
            if (current && current.token === mine) current = null;
          };
        }
        synth.speak(utterance);
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // No on-device English voice is known yet. Look again a few times, for a short while.
  // If one appears and this is still the newest line, speak it then. If not, say nothing.
  function listMayHaveArrived() {
    listTimer = null;
    if (!current || !current.needsVoice) return;
    if (chosenVoice()) {
      current.needsVoice = false;
      if (!deviceHasTheLine()) speakNow(current.parts, current.token);
      if (current && unlocked) current = null;
      return;
    }
    if (clock.now() - current.at >= LIST_WAIT_MS) {
      current.needsVoice = false;
      if (unlocked) current = null;
      return;
    }
    listTimer = clock.set(listMayHaveArrived, LIST_CHECK_EVERY_MS);
  }

  // Ask for the list straight away, and listen for the device saying it has arrived.
  if (available) {
    try {
      synth.getVoices();
      if (synth.addEventListener) {
        synth.addEventListener('voiceschanged', function () {
          if (current && current.needsVoice) { stopListWait(); listMayHaveArrived(); }
        });
      }
    } catch (error) { /* the list is asked for again when a line is spoken */ }
  }

  // Says one or more lines, one after the other. Returns true if the device was handed them.
  function say(parts) {
    const list = (Array.isArray(parts) ? parts : [parts]).filter(function (line) {
      return line && typeof line.text === 'string' && line.text !== '';
    });
    token += 1;
    const mine = token;
    current = null;
    stopListWait();
    if (list.length === 0) { stop(); return false; }
    heard.push({ at: Date.now(), ids: list.map(function (line) { return line.id; }) });
    if (heard.length > 20) heard.shift();
    if (!available) return false;
    current = { token: mine, parts: list, at: clock.now(), needsVoice: false, liftTried: false, tapTried: false, liftAt: 0 };
    const handedOver = speakNow(list, mine);
    if (!handedOver && current && current.token === mine && !chosenVoice()) {
      // Not spoken, because no on-device English voice is known. Wait a short while for one.
      current.needsVoice = true;
      listTimer = clock.set(listMayHaveArrived, LIST_CHECK_EVERY_MS);
    }
    return handedOver;
  }

  // A tablet may not speak until a finger has lifted off the screen, or until a whole tap has
  // completed. The game acts the moment a finger lands, so the very first line can be asked
  // for too early. The hub calls this when a finger lifts ("lift") and when a tap completes
  // ("tap"). Each asks once more for the newest line, but only if the device has not taken it:
  // a line the device is already holding or speaking is left alone, so it is never said twice.
  function retryAfterTouch(kind) {
    if (!available || unlocked || !current) return false;
    const now = clock.now();
    if (kind === 'lift') {
      if (current.liftTried || now - current.at > LIFT_LIMIT_MS) return false;
      current.liftTried = true;
      current.liftAt = now;
    } else {
      const since = current.liftTried ? now - current.liftAt : now - current.at;
      if (current.tapTried || since > TAP_AFTER_LIFT_MS) return false;
      current.tapTried = true;
    }
    if (deviceHasTheLine()) return false;
    return speakNow(current.parts, current.token);
  }

  function find(moment) {
    return lines.filter(function (line) { return line.moment === moment; });
  }

  return {
    available: available,
    setLines: function (newLines) { lines = (newLines || []).slice(); },
    // One line for a moment. When there are several it picks one, and skips notId if it can.
    pick: function (moment, pickOptions) {
      const all = find(moment);
      if (all.length === 0) return null;
      const notId = pickOptions && pickOptions.notId;
      const pool = all.length > 1 ? all.filter(function (line) { return line.id !== notId; }) : all;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    // The line that names one button.
    button: function (target) {
      const match = find('button_name').filter(function (line) { return line.target === target; });
      return match.length > 0 ? match[0] : null;
    },
    say: say,
    stop: stop,
    retryAfterTouch: retryAfterTouch,
    status: function () {
      const voice = chosenVoice();
      return {
        available: available,
        voices: voiceList().length,
        voice_name: voice ? voice.name : null,
        voice_lang: voice ? voice.lang : null,
        voice_on_device: voice ? isOnDevice(voice) : null,
        started_speaking: unlocked,
        lines_loaded: lines.length,
        recent: heard.slice()
      };
    }
  };
}
