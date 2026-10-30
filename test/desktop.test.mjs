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
  const pg = { text: '', load(text) {}, source: () => pg.text };
  const element = () => ({
    textContent: '',
    prepend() {},
    append() {},
    addEventListener() {},
  });
  const page = {
    querySelector: () => element(),
    createElement: element,
    addEventListener() {},
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
        async message() {},
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
  return { host, pg, calls, prompts, start, close };
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
