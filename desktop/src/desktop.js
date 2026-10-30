// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// The desktop app's side of the playground. It runs before playground.js
// and gives it window.kerfHost: .kerf files on disk with Open and Save,
// a save dialog instead of downloads, and `use <...>` / `include <...>`
// libraries read from the open file's folder, as on the command line.

(() => {
  const { core, dialog, event, opener, path } = window.__TAURI__;
  const win = window.__TAURI__.window.getCurrentWindow();
  const SITE = 'https://kerfscript.mylasertools.com';
  const KERF = [{ name: 'KerfScript', extensions: ['kerf'] }];
  const TYPES = {
    svg: [{ name: 'SVG', extensions: ['svg'] }],
    dxf: [{ name: 'DXF', extensions: ['dxf'] }],
    zip: [{ name: 'ZIP', extensions: ['zip'] }],
    kerf: KERF,
  };

  let file = null; // path of the open .kerf file
  let saved = null; // its text when last opened or saved
  let pg = null; // the playground: load(text), source()

  const base = () =>
    file
      ? file
          .split(/[\\/]/)
          .pop()
          .replace(/\.kerf$/i, '')
      : null;
  const dirty = () => file !== null && pg !== null && pg.source() !== saved;
  const title = () =>
    win.setTitle(`${file ? `${base()}.kerf` : 'Untitled'}${dirty() ? ' •' : ''} - KerfScript`);

  async function discardOk() {
    if (!dirty()) return true;
    return dialog.ask(`${base()}.kerf has unsaved changes. Discard them?`, {
      title: 'KerfScript',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Cancel',
    });
  }

  async function readFile(p) {
    return core.invoke('read_text', { path: p });
  }

  async function openPath(p) {
    if (!(await discardOk())) return;
    let text;
    try {
      text = await readFile(p);
    } catch (e) {
      await dialog.message(String(e), { title: 'Could not open the file', kind: 'error' });
      return;
    }
    file = p;
    saved = text;
    pg.load(text);
    title();
  }

  async function open() {
    const p = await dialog.open({ filters: KERF, multiple: false, directory: false });
    if (p) await openPath(p);
  }

  async function write(p, data) {
    if (typeof data === 'string') return core.invoke('write_text', { path: p, contents: data });
    const bytes = new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data);
    return core.invoke('write_bytes', { path: p, contents: Array.from(bytes) });
  }

  async function save(as) {
    let p = file;
    if (as || !p) {
      const folder = file ? await path.dirname(file) : null;
      const name = `${base() ?? 'design'}.kerf`;
      p = await dialog.save({
        filters: KERF,
        defaultPath: folder ? await path.join(folder, name) : name,
      });
      if (!p) return false;
      if (!/\.kerf$/i.test(p)) p += '.kerf';
    }
    const text = pg.source();
    try {
      await write(p, text);
    } catch (e) {
      await dialog.message(String(e), { title: 'Could not save the file', kind: 'error' });
      return false;
    }
    file = p;
    saved = text;
    title();
    return true;
  }

  // Exports: a save dialog in the open file's folder
  async function exportFile(name, data) {
    const ext = name.split('.').pop();
    const folder = file ? await path.dirname(file) : null;
    const p = await dialog.save({
      filters: TYPES[ext],
      defaultPath: folder ? await path.join(folder, name) : name,
    });
    if (!p) return;
    try {
      await write(p, data);
    } catch (e) {
      await dialog.message(String(e), { title: 'Could not save the file', kind: 'error' });
    }
  }

  // Libraries the program uses, read relative to the open file's folder like
  // the command line does. Standard library paths are not files and are
  // skipped; the renderer looks them up first.
  async function libraries(source) {
    if (!file) return undefined;
    const dir = await path.dirname(file);
    const files = {};
    const queue = [source];
    while (queue.length) {
      for (const [, p] of queue.pop().matchAll(/\b(?:use|include)\s*<([^>]+)>/g)) {
        if (p in files) continue;
        files[p] = null;
        for (const candidate of [p, `${p}.kerf`]) {
          try {
            const text = await readFile(await path.join(dir, candidate));
            files[p] = text;
            queue.push(text);
            break;
          } catch {}
        }
      }
    }
    for (const p of Object.keys(files)) if (files[p] === null) delete files[p];
    return files;
  }

  async function nextOpened() {
    const [p] = await core.invoke('opened_files');
    return p ?? null;
  }

  // LightBurn 2.2 and later: open the cut file there through its REST API
  // (src-tauri/src/lightburn.rs). The first time, LightBurn asks the user to
  // allow KerfScript; the job is always started by the user in LightBurn.
  const LIGHTBURN_ERRORS = {
    'not-running':
      'LightBurn is not running. Start LightBurn 2.2 or later, then try again. Older versions cannot receive files from other apps.',
    declined:
      "LightBurn did not allow KerfScript to send files. Try again and choose Allow in LightBurn's window; it closes after 30 seconds, and may be behind other windows.",
    'needs-pairing':
      'LightBurn did not accept KerfScript. In LightBurn, open Settings → Extensions → Manage API Authorizations, remove KerfScript, then try again.',
  };

  async function lightburn(name, svg, button) {
    const label = button.textContent;
    const send = () => core.invoke('lightburn_open', { name, contents: svg });
    button.disabled = true;
    try {
      button.textContent = 'Sending…';
      try {
        await send();
      } catch (e) {
        if (e !== 'needs-pairing') throw e;
        button.textContent = 'Allow in LightBurn…';
        await core.invoke('lightburn_pair');
        button.textContent = 'Sending…';
        await send();
      }
      button.textContent = 'Opened in LightBurn';
      setTimeout(() => (button.textContent = label), 2500);
    } catch (e) {
      button.textContent = label;
      await dialog.message(LIGHTBURN_ERRORS[e] ?? String(e), {
        title: 'Open in LightBurn',
        kind: 'warning',
      });
    } finally {
      button.disabled = false;
    }
  }

  window.kerfHost = {
    shareBase: `${SITE}/playground/`,
    name: base,
    libraries,
    lightburn,
    changed: title,
    save(name, data) {
      return name.endsWith('.kerf') ? save(true) : exportFile(name, data);
    },
    // Before the playground loads an example: the open file stops being open
    async release() {
      if (!(await discardOk())) return false;
      file = null;
      saved = null;
      title();
      return true;
    },
    attach(playground) {
      pg = playground;
      const actions = document.querySelector('.pg-actions');
      const button = (label, onClick) => {
        const b = Object.assign(document.createElement('button'), {
          className: 'button',
          textContent: label,
        });
        b.addEventListener('click', onClick);
        return b;
      };
      actions.prepend(
        button('Open…', open),
        button('Save', () => save(false)),
      );
      document.querySelector('[data-download="kerf"]').textContent = 'Save as…';
      document.querySelector('[data-share]').textContent = 'Copy web link';
    },
    // A file the app was started with, from the command line or a double click
    async initial() {
      const p = await nextOpened();
      if (!p) {
        title();
        return null;
      }
      try {
        const text = await readFile(p);
        file = p;
        saved = text;
        title();
        return text;
      } catch {
        return null;
      }
    },
  };

  // Links in the page go to the website, in the system browser
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    e.preventDefault();
    opener.openUrl(new URL(a.getAttribute('href'), SITE).href);
  });

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'o') open();
    else if (key === 's') save(e.shiftKey);
    else return;
    e.preventDefault();
  });

  // macOS opens files in the running app
  event.listen('open-files', async () => {
    const p = await nextOpened();
    if (p) openPath(p);
  });

  win.onCloseRequested(async (e) => {
    if (!(await discardOk())) e.preventDefault();
  });
})();
