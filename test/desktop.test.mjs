import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as kerfscript from '../dist/index.js';

// Runs desktop/src/desktop.js, the desktop app's side of the playground, with
// stand-ins for Tauri, the page and the playground.
function desktop({ invoke = {}, discard = false } = {}) {
  const calls = [];
  const prompts = [];
  let closeHandler = null;
  const handlers = {};
  const pg = {
    text: '',
    loads: [],
    refreshes: 0,
    load(text) {
      pg.loads.push(text);
      pg.text = text;
    },
    source: () => pg.text,
    refresh() {
      pg.refreshes++;
    },
  };
  const element = () => ({
    textContent: '',
    prepend() {},
    append() {},
    addEventListener() {},
  });
  const page = {
    querySelector: () => element(),
    createElement: element,
    addEventListener(type, f) {
      handlers[type] = f;
    },
  };
  const window = {
    __TAURI__: {
      core: {
        async invoke(cmd, args) {
          calls.push([cmd, args]);
          const reply = invoke[cmd];
          return typeof reply === 'function' ? reply(args) : reply;
        },
      },
      dialog: {
        async ask(message) {
          prompts.push(message);
          return discard;
        },
        // What the dialog plugin gives back: the button pressed
        async message(message) {
          prompts.push(message);
          return 'Ok';
        },
      },
      event: { listen() {} },
      opener: { openUrl() {} },
      window: {
        getCurrentWindow: () => ({
          setTitle() {},
          onCloseRequested(f) {
            closeHandler = f;
          },
        }),
      },
      app: { getVersion: async () => '0.0.0' },
    },
  };
  const source = readFileSync(new URL('../desktop/src/desktop.js', import.meta.url), 'utf8')
    // The script loads the bundled library from the page's assets
    .replace("import('/assets/kerfscript.js')", 'Promise.resolve(kerfscript)');
  vm.runInNewContext(source, { window, document: page, kerfscript, URL, Blob });
  const host = window.kerfHost;
  // What playground.js does when it starts: attach, then load the first code
  const start = async (text, example = false) => {
    host.attach(pg);
    pg.text = text;
    host.loaded(text, example);
  };
  const close = async () => {
    let prevented = false;
    await closeHandler({ preventDefault: () => (prevented = true) });
    return prevented;
  };
  // Ctrl+<key> in the page
  const keys = (key, shiftKey = false) =>
    handlers.keydown({ ctrlKey: true, key, shiftKey, preventDefault() {} });
  return { host, pg, calls, prompts, start, close, keys };
}

test('unsaved changes to an untitled design are not lost without asking', async () => {
  const d = desktop();
  await d.start('rect(10);', true);
  assert.equal(await d.host.release(), true, 'an unchanged example can be replaced');
  assert.equal(d.prompts.length, 0);
  d.pg.text = 'rect(20);';
  assert.equal(await d.host.release(), false, 'an edited example asks first');
  assert.equal(d.prompts.length, 1);
  assert.equal(await d.close(), true, 'closing asks too');
});

test('a draft from last time counts as unsaved work', async () => {
  const d = desktop();
  await d.start('circle(5);', false);
  assert.equal(await d.host.release(), false);
  assert.equal(d.prompts.length, 1);
});

test('an empty file opens as an empty design, not as other code', async () => {
  const d = desktop({ invoke: { open_pending: { name: 'blank', text: '' } } });
  assert.equal(await d.host.initial(), '');
  await d.start('');
  assert.equal(d.host.name(), 'blank');
  assert.equal(await d.close(), false, 'nothing to save');
});

test('Save on an untitled design asks where to save it', async () => {
  const d = desktop({ invoke: { save_design: 'box' } });
  await d.start('rect(1);', true);
  d.pg.text = 'rect(2);';
  await d.host.save('design.kerf', 'rect(2);');
  const [, args] = d.calls.find(([cmd]) => cmd === 'save_design');
  assert.equal(args.saveAs, true);
  assert.equal(d.host.name(), 'box');
  assert.equal(await d.close(), false, 'saved');
});

test('libraries come from use and include, not from comments or strings', async () => {
  const read = [];
  const d = desktop({
    invoke: {
      open_pending: { name: 'box', text: '' },
      read_library: ({ path }) => {
        read.push(path);
        if (path === 'lib/tab') return 'include <lib/inner>\n';
        if (path === 'lib/inner') return 'module inner() rect(1);\n';
        throw 'not found';
      },
    },
  });
  await d.host.initial();
  const files = await d.host.libraries(
    '// use <commented>\nuse <lib/tab>\nlabel = "use <in a string>";\nuse <kerf/box>\n',
  );
  assert.deepEqual(read, ['lib/tab', 'lib/inner']);
  assert.deepEqual(Object.keys(files).sort(), ['lib/inner', 'lib/tab']);
});

test('an untitled design reads no files', async () => {
  const d = desktop();
  await d.start('use <lib/tab>\n');
  assert.equal(await d.host.libraries('use <lib/tab>\n'), undefined);
  assert.equal(
    d.calls.some(([cmd]) => cmd === 'read_library'),
    false,
  );
});

test('a file that cannot be opened leaves the open design as it was', async () => {
  const d = desktop({
    invoke: {
      open_pending: { name: 'box', text: 'rect(1);' },
      open_design: () => Promise.reject('big.kerf is larger than 3 MB'),
    },
  });
  d.pg.text = await d.host.initial();
  await d.start(d.pg.text);
  await d.keys('o');
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(d.prompts, ['big.kerf is larger than 3 MB']);
  assert.deepEqual(d.pg.loads, [], 'nothing is loaded');
  assert.equal(d.host.name(), 'box');
  // Save still saves box.kerf, not over another file
  d.pg.text = 'rect(2);';
  d.calls.length = 0;
  await d.keys('s');
  await new Promise((r) => setTimeout(r));
  assert.equal(d.calls.find(([cmd]) => cmd === 'save_design')[1].saveAs, false);
});

test('a save that fails keeps the changes unsaved', async () => {
  const d = desktop({
    invoke: {
      open_pending: { name: 'box', text: 'rect(1);' },
      save_design: () => Promise.reject('box.kerf: permission denied'),
    },
  });
  d.pg.text = await d.host.initial();
  await d.start(d.pg.text);
  d.pg.text = 'rect(2);';
  assert.equal(await d.host.save('box.kerf', 'rect(2);'), false);
  assert.equal(d.host.name(), 'box');
  assert.equal(await d.close(), true, 'closing still asks');
});

test('saving under a new name renders again, for libraries next to it', async () => {
  const d = desktop({ invoke: { save_design: 'box' } });
  await d.start('use <lib/tab>;', true);
  d.pg.text = 'use <lib/tab>; rect(1);';
  await d.host.save('design.kerf', d.pg.text);
  assert.equal(d.pg.refreshes, 1);
  await d.host.save('box.kerf', d.pg.text);
  assert.equal(d.pg.refreshes, 1, 'not when the name stays');
});

test('one file dialog at a time', async () => {
  let finish;
  const d = desktop({
    invoke: { save_design: () => new Promise((r) => (finish = r)), open_design: null },
  });
  await d.start('rect(1);');
  d.pg.text = 'rect(2);';
  const saving = d.host.save('design.kerf', d.pg.text);
  await d.keys('o');
  assert.equal(d.calls.filter(([cmd]) => cmd === 'open_design').length, 0);
  finish('box');
  assert.equal(await saving, true);
});
