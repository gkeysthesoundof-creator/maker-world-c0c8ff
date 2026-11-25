// Offline behavior. Registers the service worker (src/sw.js), which stores every game file
// on the device at the first load so the game runs with the network off.
//
// Updates: a new version is stored quietly in the background. It is only switched on while
// the Front Door is showing, never in the middle of play.

const WORKER_URL = new URL('../sw.js', import.meta.url);

export function startOffline(options) {
  const canApplyUpdate = (options && options.canApplyUpdate) || function () { return false; };
  const info = { supported: 'serviceWorker' in navigator, registered: false, error: null, update_waiting: false };
  let registration = null;
  let reloaded = false;

  function tryApply() {
    if (!registration || !registration.waiting) return false;
    info.update_waiting = true;
    if (!navigator.serviceWorker.controller || !canApplyUpdate()) return false;
    registration.waiting.postMessage({ type: 'APPLY_UPDATE' });
    return true;
  }

  if (info.supported) {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded || !canApplyUpdate()) return;
      reloaded = true;
      globalThis.location.reload();
    });

    navigator.serviceWorker.register(WORKER_URL.href).then(function (found) {
      registration = found;
      info.registered = true;
      tryApply();
      found.addEventListener('updatefound', function () {
        const fresh = found.installing;
        if (!fresh) return;
        fresh.addEventListener('statechange', function () {
          if (fresh.state === 'installed') tryApply();
        });
      });
    }).catch(function (error) {
      info.error = String(error && error.message ? error.message : error);
    });
  }

  // Asks the service worker what it has stored. Answers null if there is no worker in charge.
  function report() {
    return new Promise(function (resolve) {
      const worker = info.supported ? navigator.serviceWorker.controller : null;
      if (!worker) { resolve(null); return; }
      const channel = new MessageChannel();
      const timer = setTimeout(function () { resolve(null); }, 3000);
      channel.port1.onmessage = function (event) { clearTimeout(timer); resolve(event.data); };
      worker.postMessage({ type: 'REPORT' }, [channel.port2]);
    });
  }

  return {
    info: function () {
      return {
        supported: info.supported,
        registered: info.registered,
        in_charge: info.supported ? Boolean(navigator.serviceWorker.controller) : false,
        update_waiting: info.update_waiting,
        error: info.error
      };
    },
    report: report,
    applyUpdateIfWaiting: tryApply
  };
}
