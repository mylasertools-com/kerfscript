// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Talks to worker.js. Only the newest request matters: older answers are
// dropped, and a render that runs too long restarts the worker.

const TIMEOUT_MS = 15000;

export function createEngine() {
  let worker = null;
  let latest = 0;
  let pending = null;

  const start = () => {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      if (!pending || event.data.id !== pending.id) return;
      clearTimeout(pending.timer);
      const { resolve } = pending;
      pending = null;
      resolve(event.data);
    };
  };

  return function run(source, params, files) {
    if (!worker) start();
    const id = ++latest;
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve({ id: pending.id, stale: true });
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        worker.terminate();
        worker = null;
        pending = null;
        resolve({
          id,
          ok: false,
          error: 'Stopped after 15 seconds. Is there a loop that never ends?',
          echoes: [],
        });
      }, TIMEOUT_MS);
      pending = { id, resolve, timer };
      worker.postMessage({ id, source, params, files });
    });
  };
}
