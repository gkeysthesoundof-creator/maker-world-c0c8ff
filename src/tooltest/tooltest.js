// Tool test page for order RW-001. It checks, on whatever device opens it, that the chosen
// tools work from inside the game with nothing loaded from anywhere else:
// saving, packs, the offline store, the device voice, the drawing canvas and Phaser.
// Results are also put on window.RomansWorldToolTest for the automatic checks.

import { startEngine } from '../engine/engine.js';

const results = { done: false, rows: {} };
window.RomansWorldToolTest = results;

const table = document.getElementById('rows');

function row(name, ok, detail) {
  results.rows[name] = { ok: ok, detail: detail };
  let line = document.getElementById('row-' + name);
  if (!line) {
    line = document.createElement('tr');
    line.id = 'row-' + name;
    table.appendChild(line);
  }
  line.textContent = '';
  const mark = document.createElement('td');
  mark.className = 'mark ' + (ok === true ? 'yes' : ok === false ? 'no' : '');
  mark.textContent = ok === true ? 'OK' : ok === false ? 'NOT OK' : 'INFO';
  const label = document.createElement('td');
  label.textContent = name;
  const text = document.createElement('td');
  text.textContent = detail;
  line.appendChild(mark);
  line.appendChild(label);
  line.appendChild(text);
}

function screenRow() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  row('screen', null, window.innerWidth + ' by ' + window.innerHeight + ' points, sharpness ' +
    window.devicePixelRatio + ', ' + (window.innerWidth >= window.innerHeight ? 'landscape' : 'upright') +
    ', ' + (standalone ? 'opened from the home screen' : 'opened in the browser') +
    ', touch points ' + (navigator.maxTouchPoints || 0));
}

function canvasCheck() {
  const canvas = document.getElementById('canvas');
  const pen = canvas.getContext('2d');
  pen.fillStyle = '#ffffff';
  pen.fillRect(0, 0, 320, 120);
  pen.lineWidth = 8;
  pen.strokeStyle = '#111111';
  pen.fillStyle = '#e3262e';
  pen.beginPath();
  pen.arc(60, 60, 40, 0, Math.PI * 2);
  pen.fill();
  pen.stroke();
  pen.strokeRect(130, 20, 160, 80);
  const pixel = pen.getImageData(60, 60, 1, 1).data;
  const red = pixel[0] > 200 && pixel[1] < 80 && pixel[2] < 80;
  row('drawing canvas', red, red ? 'Drew a red circle and read its color back.' : 'Could not read back what was drawn.');
}

async function phaserCheck(engine) {
  let Phaser = null;
  try {
    Phaser = await engine.libs.load('phaser');
  } catch (error) {
    row('phaser', false, String(error.message));
    return;
  }
  const seen = { frames: 0, taps: 0, renderer: null };
  results.phaser = seen;
  let ball = null;
  let speedX = 150;
  let speedY = 120;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'phaser-box',
    width: 480,
    height: 270,
    backgroundColor: '#ffffff',
    banner: false,
    audio: { noAudio: true },
    scene: {
      create: function () {
        seen.renderer = this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
        ball = this.add.circle(120, 90, 34, 0xffffff);
        ball.setStrokeStyle(8, 0x111111);
        ball.setInteractive(new Phaser.Geom.Circle(34, 34, 44), Phaser.Geom.Circle.Contains);
        ball.on('pointerdown', function () {
          seen.taps += 1;
          ball.setFillStyle(0xe3262e);
        });
      },
      update: function (time, delta) {
        seen.frames += 1;
        const step = Math.min(delta, 50) / 1000;
        ball.x += speedX * step;
        ball.y += speedY * step;
        if (ball.x < 40 || ball.x > 440) speedX = -speedX;
        if (ball.y < 40 || ball.y > 230) speedY = -speedY;
        seen.x = ball.x;
        seen.y = ball.y;
      }
    }
  });
  results.phaserGame = function () { return game; };
  await new Promise(function (resolve) { setTimeout(resolve, 1200); });
  const moving = seen.frames > 5;
  row('phaser', moving, moving
    ? 'Version ' + Phaser.VERSION + ', loaded from inside the game, drawing with ' + seen.renderer + ', ' + seen.frames + ' frames so far.'
    : 'Version ' + Phaser.VERSION + ' loaded but drew ' + seen.frames + ' frames.');
}

async function offlineRow(engine) {
  const info = engine.offline.info();
  if (!info.supported) { row('offline store', false, 'This browser has no service worker.'); return; }
  let report = null;
  for (let i = 0; i < 30 && !report; i += 1) {
    report = await engine.offline.report();
    if (!report) await new Promise(function (resolve) { setTimeout(resolve, 300); });
  }
  if (!report) { row('offline store', false, 'The service worker is not in charge yet. Close this page and open it again.'); return; }
  results.offline = report;
  const full = report.stored >= report.wanted && report.missing.length === 0;
  row('offline store', full, 'Version ' + report.version + ', ' + report.stored + ' of ' + report.wanted +
    ' files stored on this device' + (report.missed.length ? ', asked for but not stored: ' + report.missed.join(', ') : '') + '.');
}

function networkRow() {
  const outside = performance.getEntriesByType('resource').map(function (entry) { return entry.name; })
    .filter(function (name) { return name.indexOf(location.origin) !== 0 && !/^(data|blob):/.test(name); });
  results.outside = outside;
  row('nothing from outside', outside.length === 0, outside.length === 0
    ? 'Every file this page loaded came from the game itself.'
    : 'Loaded from somewhere else: ' + outside.join(', '));
}

async function main() {
  screenRow();
  canvasCheck();

  let engine = null;
  try {
    engine = await startEngine({ countOpen: false });
  } catch (error) {
    row('engine', false, 'The engine did not start: ' + error.message);
    results.done = true;
    return;
  }
  row('engine', true, 'Version ' + engine.version + '.');

  const save = engine.save.status();
  const snapshot = engine.save.snapshot();
  row('saving', save.saving && save.storage_available, 'Save version ' + save.save_version + ', state "' + save.state +
    '", opened ' + snapshot.app.opens + ' times, first made ' + snapshot.created_at + '.' + (save.notes.length ? ' ' + save.notes.join(' ') : ''));

  const packs = engine.packs;
  row('packs', packs.loaded.length > 0 && packs.rejected.length === 0,
    packs.loaded.map(function (pack) { return pack.pack_id + (pack.placeholder ? ' (PLACEHOLDER)' : ''); }).join(', ') +
    (packs.rejected.length ? ' REJECTED: ' + packs.rejected.map(function (entry) { return entry.file + ': ' + entry.reasons.join(' '); }).join(' | ') : ''));

  const voice = engine.voice.status();
  row('voice', voice.available, voice.available
    ? voice.voices + ' voices on this device, the game would use "' + voice.voice_name + '" (' + voice.voice_lang + '), ' + voice.lines_loaded + ' lines loaded.'
    : 'This browser has no built-in voice.');

  document.getElementById('say').addEventListener('click', function () {
    const line = engine.voice.pick('welcome');
    const accepted = engine.voice.say([line]);
    const out = document.getElementById('say-result');
    out.textContent = accepted ? ' Asked the device to speak.' : ' The device did not accept the line.';
    setTimeout(function () {
      const after = engine.voice.status();
      results.spoke = after.started_speaking;
      out.textContent = after.started_speaking
        ? ' The device says it started speaking, using "' + after.voice_name + '". Did you hear it?'
        : ' The device has not started speaking. Check the mute switch and the volume.';
      row('voice', after.available, after.voices + ' voices on this device, using "' + after.voice_name + '" (' + after.voice_lang + '), started speaking: ' + after.started_speaking + '.');
    }, 1500);
  });

  await phaserCheck(engine);
  await offlineRow(engine);
  networkRow();
  setTimeout(function () { row('keep the save', null, 'Device answer to "keep this data safe": ' + engine.storageKeepAnswer()); }, 500);
  results.done = true;
}

main();
