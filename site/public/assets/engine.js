// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Talks to worker.js. Only the newest request matters: the worker runs one
// render at a time, a request waiting for it is replaced by a newer one, and
// older answers come back as stale. A render that runs too long, or an old
// one that keeps a newer request waiting, restarts the worker.

const TIMEOUT_MS = 15000;
// How long an old render may keep a newer request waiting
const STALE_MS = 1000;

export function createEngine() {
  let worker = null;
  let latest = 0;
  // The render the worker is running: { id, resolve, timer, started }
  let running = null;
  // The newest request, waiting for the worker: { id, resolve, request }
  let waiting = null;

  const answer = (job, data) => job.resolve({ id: job.id, ...data });
  const stale = (job) => answer(job, { stale: true });

  function start() {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      if (!running || event.data.id !== running.id) return;
      const job = running;
      clearTimeout(job.timer);
      running = null;
      job.resolve(event.data);
      next();
    };
    // The worker could not load, or a message could not be read
    const failed = (event) => {
      event.preventDefault?.();
      restart(`The renderer stopped: ${event.message || 'it could not load'}`);
    };
    worker.onerror = failed;
    worker.onmessageerror = failed;
  }

  // Replaces the worker. The render it ran gets `error` (its answer is
  // ignored if it was already stale), and the waiting request starts.
  function restart(error) {
    worker?.terminate();
    worker = null;
    const job = running;
    running = null;
    if (job) {
      clearTimeout(job.timer);
      answer(job, { ok: false, error, echoes: [] });
    }
    next();
  }

  function next() {
    if (running || !waiting) return;
    if (!worker) start();
    const job = { ...waiting, started: performance.now() };
    waiting = null;
    running = job;
    job.timer = setTimeout(
      () => restart('Stopped after 15 seconds. Is there a loop that never ends?'),
      TIMEOUT_MS,
    );
    worker.postMessage({ id: job.id, ...job.request });
  }

  return function run(source, params, files) {
    const id = ++latest;
    if (waiting) stale(waiting);
    return new Promise((resolve) => {
      waiting = { id, resolve, request: { source, params, files } };
      if (running) {
        // An old render that takes long is not worth waiting for: give it
        // until STALE_MS after it started, then restart the worker
        stale(running);
        clearTimeout(running.timer);
        const left = STALE_MS - (performance.now() - running.started);
        if (left <= 0) restart('stale');
        else running.timer = setTimeout(() => restart('stale'), left);
      } else next();
    });
  };
}
