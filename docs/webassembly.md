# WebAssembly

`kerfscript.wasm` runs KerfScript from any language that can host a
WebAssembly module: Python, Rust, Go, C#, Java, Ruby and others. It is a
WASI (preview 1) module built from the same source as the JavaScript package,
so it makes the same SVG and DXF files, byte for byte.

For JavaScript applications, use the [JavaScript API](javascript.md)
instead: it is smaller and faster.

## Getting the module

Download `kerfscript.wasm` from the
[releases](https://github.com/mylasertools/kerfscript/releases) page, or build
it from the repository with [Javy](https://github.com/bytecodealliance/javy):

```sh
npm run build
npm run wasm        # writes dist/kerfscript.wasm
```

Set `JAVY` to the javy binary if it is not on the `PATH`.

## How it works

The module reads one JSON request from standard input, writes one JSON
response to standard output and exits. Start a fresh instance for each
request. From a shell, with [Wasmtime](https://wasmtime.dev):

```sh
echo '{"source": "rect([80, 50]);"}' | wasmtime run kerfscript.wasm
```

### Request

| Field | Value |
| --- | --- |
| `command` | `"render"` (default), `"params"` or `"version"` |
| `source` | The program, as a string |
| `params` | Parameter values keyed by name |
| `files` | Libraries for `include` and `use`, keyed by path: `{"lib/tab.kerf": "..."}` |
| `fonts` | Font files keyed by name, base64 encoded. `Atkinson` is built in |
| `defaultFont` | Name to use when `text()` does not specify a font |
| `kerf` | Kerf override for every part, in millimetres |
| `layout` | `"pack"` (default) or `"none"` |
| `sheet` | Sheet size `[width, height]` in millimetres |
| `gap` | Space between packed parts |
| `margin` | Space between the parts and the sheet edge |
| `guides` | `true` to include guide layer geometry |

These match the [render() options](javascript.md#options). A path in `files`
can leave out `.kerf`, as in the program.

### Response

Every response has `ok`. When it is `false`, `error` holds the message and
`echoes` holds what the program echoed before it stopped. The module never
exits with an error code for a bad program.

- `render`: `svg` (all sheets, for preview), `width`, `height`, `parts`,
  `warnings`, `echoes` and `sheets`. Each sheet has `width`, `height`,
  `material`, `thickness`, `svg` and `dxf`; write one file per sheet to cut.
- `params`: `parameters`, as from [`parameters()`](javascript.md).
- `version`: `version` (package) and `language`.

## Python

With the [`wasmtime`](https://pypi.org/project/wasmtime/) package:

```python
import json, os, tempfile
from wasmtime import Engine, Linker, Module, Store, WasiConfig

engine = Engine()
module = Module.from_file(engine, "kerfscript.wasm")
linker = Linker(engine)
linker.define_wasi()

def kerf(request):
    with tempfile.TemporaryDirectory() as d:
        inp, out = os.path.join(d, "in.json"), os.path.join(d, "out.json")
        with open(inp, "w", encoding="utf-8") as f:
            json.dump(request, f)
        wasi = WasiConfig()
        wasi.stdin_file = inp
        wasi.stdout_file = out
        store = Store(engine)
        store.set_wasi(wasi)
        linker.instantiate(store, module).exports(store)["_start"](store)
        with open(out, encoding="utf-8") as f:
            return json.load(f)

result = kerf({"source": "w = 80; rect([w, 50]);", "params": {"w": 120}})
for i, sheet in enumerate(result["sheets"]):
    with open(f"sheet-{i + 1}.svg", "w", encoding="utf-8", newline="") as f:
        f.write(sheet["svg"])
```

Compile the module once and reuse it; each request only needs a new `Store`.

## Node.js

The JavaScript package is the better fit in Node.js, but the module also runs
under `node:wasi`, which is how the test suite checks it:

```js
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { WASI } from 'node:wasi';

const module = await WebAssembly.compile(readFileSync('kerfscript.wasm'));
writeFileSync('in.json', JSON.stringify({ source: 'rect([80, 50]);' }));
const stdin = openSync('in.json', 'r');
const stdout = openSync('out.json', 'w');
const wasi = new WASI({ version: 'preview1', stdin, stdout, returnOnExit: true });
wasi.start(await WebAssembly.instantiate(module, wasi.getImportObject()));
closeSync(stdin);
closeSync(stdout);
console.log(JSON.parse(readFileSync('out.json', 'utf8')).svg);
```

## Performance

The module carries its own JavaScript engine (QuickJS), so it is about 1.8 MB
and renders roughly three to five times slower than Node.js. The example
designs take well under a second.
