// The home hub: Front Door, seven picture buttons and the Coming Soon card.
// Built to specs/RW-001-home-hub.md. Touch only. One touch does everything.
// There is no spoken text in this file. Every line comes from the voice pack.

import { startEngine } from '../engine/engine.js';
import { MODES } from './modes.js';
import { modeFace, cardPicture, homeFace, buddy, turnPicture } from './pictures.js';

const STAGE_WIDTH = 1024;
const STAGE_HEIGHT = 768;
const QUIET_AFTER_DOOR = 600;    // buttons wake up after they have slid in
const QUIET_AFTER_CARD = 500;    // so a double tap does not open and close a card
const QUIET_AFTER_CLOSE = 300;   // so a double tap outside a card does not open the room underneath
const BACK_TO_DOOR_AFTER = 60000; // away this long, then he lands on the Front Door again
const READY_NO_MATTER_WHAT = 2500;

const stage = document.getElementById('stage');
const door = document.getElementById('door');
const buddyButton = document.getElementById('buddy');
const modesBox = document.getElementById('modes');
const soon = document.getElementById('soon');
const soonDim = document.getElementById('soon-dim');
const soonPicture = document.getElementById('soon-picture');
const homeButton = document.getElementById('home');

const state = { look: 'loading', card: null, quietUntil: 0, hiddenAt: 0, engine: null };

function now() { return Date.now(); }

// A press counts the moment the finger lands. A slip still counts.
// Safety net: now and then a browser delivers a tap as a plain "click" with no finger-down
// event before it (seen in Chrome in the first moments after a page loads). A click that
// arrives with no finger-down before it is treated as the press, so no touch is ever lost.
const PRESS_EVENT = window.PointerEvent ? 'pointerdown' : ('ontouchstart' in window ? 'touchstart' : 'mousedown');
let fingerDownSeen = false;
let clickHadFingerDown = true;
window.addEventListener(PRESS_EVENT, function () { fingerDownSeen = true; }, true);
window.addEventListener('click', function () { clickHadFingerDown = fingerDownSeen; fingerDownSeen = false; }, true);

function onPress(element, handler) {
  element.addEventListener(PRESS_EVENT, function (event) {
    if (event.button > 0) return;
    handler(event);
  }, PRESS_EVENT === 'touchstart' ? { passive: true } : false);
  // detail 0 is a keyboard press, for a grown-up testing on a computer.
  element.addEventListener('click', function (event) {
    if (event.detail === 0 || !clickHadFingerDown) handler(event);
  });
}

function flash(element, ms) {
  element.classList.add('is-pressed');
  setTimeout(function () { element.classList.remove('is-pressed'); }, ms || 380);
}

function hop() {
  buddyButton.classList.remove('is-hopping');
  void buddyButton.offsetWidth;   // lets the hop start again from the beginning
  buddyButton.classList.add('is-hopping');
  setTimeout(function () { buddyButton.classList.remove('is-hopping'); }, 1700);
}

function setLook(look) {
  state.look = look;
  stage.setAttribute('data-look', look);
}

function greet() {
  hop();
  const engine = state.engine;
  if (!engine) return;
  const line = engine.voice.pick('welcome', { notId: engine.save.app.get().last_welcome_id });
  if (!line) return;
  engine.voice.say([line]);
  engine.save.app.update(function (app) {
    app.greetings = (app.greetings || 0) + 1;
    app.last_welcome_id = line.id;
  });
}

function openDoor() {
  if (state.look !== 'door') return;
  setLook('hub');
  state.quietUntil = now() + QUIET_AFTER_DOOR;
  greet();
}

function openCard(mode) {
  state.card = mode.id;
  soonPicture.innerHTML = cardPicture(mode.picture);
  soon.classList.add('is-open');
  state.quietUntil = now() + QUIET_AFTER_CARD;
}

function closeCard(spokenLine) {
  if (!state.card) return;
  state.card = null;
  soon.classList.remove('is-open');
  state.quietUntil = now() + QUIET_AFTER_CLOSE;
  if (!state.engine) return;
  if (spokenLine) state.engine.voice.say([spokenLine]); else state.engine.voice.stop();
}

function pressMode(mode, button) {
  if (state.look !== 'hub' || state.card || now() < state.quietUntil) return;
  flash(button);
  const voice = state.engine ? state.engine.voice : null;
  if (mode.built) {
    // A later order starts the room here.
    if (voice) voice.say([voice.button(mode.id)]);
    return;
  }
  if (voice) voice.say([voice.button(mode.id), voice.pick('coming_soon')]);
  openCard(mode);
}

function fit() {
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
  stage.style.setProperty('--s', String(scale > 0 ? scale : 1));
}

function backToDoor() {
  if (state.look !== 'hub') return;
  state.card = null;
  soon.classList.remove('is-open');
  setLook('door');
}

// Draw everything.
buddyButton.innerHTML = buddy();
homeButton.innerHTML = homeFace();
document.getElementById('turn').innerHTML = turnPicture();
MODES.forEach(function (mode) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mode';
  button.setAttribute('data-mode', mode.id);
  button.setAttribute('data-built', String(mode.built));
  button.innerHTML = modeFace(mode.picture, mode.built);
  onPress(button, function () { pressMode(mode, button); });
  modesBox.appendChild(button);
});

onPress(door, openDoor);
onPress(buddyButton, function () {
  if (state.look !== 'hub' || state.card || now() < state.quietUntil) return;
  greet();
});
onPress(homeButton, function () {
  if (!state.card || now() < state.quietUntil) return;
  flash(homeButton, 200);
  closeCard(state.engine ? state.engine.voice.button('home') : null);
});
onPress(soonDim, function () {
  if (!state.card || now() < state.quietUntil) return;
  closeCard(null);
});

// The very first spoken line may need the finger to lift first (see engine/voice.js).
window.addEventListener('touchend', function () { if (state.engine) state.engine.voice.retryAfterTouch('lift'); }, true);
window.addEventListener('click', function () { if (state.engine) state.engine.voice.retryAfterTouch('tap'); }, true);

// Small hands: no menus, no zoom, no dragging, no scrolling.
['contextmenu', 'gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'dragstart'].forEach(function (name) {
  document.addEventListener(name, function (event) { event.preventDefault(); });
});
document.addEventListener('touchmove', function (event) { event.preventDefault(); }, { passive: false });

window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();

// Leaving the game stops the voice. Coming back after a while lands on the Front Door.
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    state.hiddenAt = now();
    if (state.engine) state.engine.voice.stop();
    return;
  }
  fit();
  if (state.hiddenAt && now() - state.hiddenAt > BACK_TO_DOOR_AFTER) {
    backToDoor();
    if (state.engine) state.engine.offline.applyUpdateIfWaiting();
  }
});

function ready() {
  if (state.look === 'loading') setLook('door');
}

// If something is slow or broken, the Front Door still opens, in silence.
setTimeout(ready, READY_NO_MATTER_WHAT);

startEngine({
  // A new version of the game is only switched on while the Front Door is showing.
  canApplyUpdate: function () { return state.look !== 'hub'; }
}).then(function (engine) {
  state.engine = engine;
  // Screen readers get the same names the voice speaks, taken from the pack.
  const nameFor = function (target) { const line = engine.voice.button(target); return line ? line.text : ''; };
  Array.prototype.forEach.call(modesBox.children, function (button) {
    const name = nameFor(button.getAttribute('data-mode'));
    if (name) button.setAttribute('aria-label', name);
  });
  if (nameFor('home')) homeButton.setAttribute('aria-label', nameFor('home'));
  ready();
}).catch(function () {
  ready();
});

// For the tool test and the automatic checks. Not used by the game itself.
window.RomansWorldDebug = { state: state };
