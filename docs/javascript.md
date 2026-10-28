# JavaScript API

The same interpreter that runs the command line and the playground is a
TypeScript library with no native code. It runs in browsers, web workers,
Node.js and edge runtimes.

```sh
npm install @mylasertools/kerfscript
```

## render()

```js
import { render } from '@mylasertools/kerfscript';

const result = render(source, {
  params: { width: 200 },
  fonts: { Inter: await (await fetch('/Inter.ttf')).arrayBuffer() },
  defaultFont: 'Inter',
  sheet: [600, 400],
});
```

### Options

| Option        | Meaning                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `params`      | setting values by name, overriding the top-level assignments                         |
| `fonts`       | font files by name, as `ArrayBuffer` or `Uint8Array`                                 |
| `defaultFont` | font used when `text()` names none                                                   |
| `resolve`     | `(path) => source` for `use <path>` and `include <path>` beyond the standard library |
| `kerf`        | override kerf compensation for every part                                            |
| `layout`      | `"pack"` or `"none"`                                                                 |
| `sheet`       | `[width, height]` in mm                                                              |
| `gap`         | space between packed parts                                                           |
| `margin`      | space around the sheet edge (default: `gap`)                                         |
| `guides`      | include guide layer geometry                                                         |
| `maxSteps`    | step limit before the program is stopped                                             |

### Result

| Field             | Contents                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `svg`             | every sheet in one SVG, for previews                                                                       |
| `width`, `height` | size of that combined SVG in mm                                                                            |
| `sheets`          | one entry per sheet: `width`, `height`, `material`, `thickness`, `svg`, `dxf`, `paths`, `items`            |
| `parts`           | `name`, `qty`, `width`, `height`, `pieces`, `cutLength`, `thickness`, `kerf`, `material`                   |
| `paths`           | per layer: `name`, `mode`, `color`, `d` (all path data), `regions` (closed outlines), `lines` (open lines) |
| `layers`          | the layer definitions in output order                                                                      |
| `warnings`        | problems that did not stop the render                                                                      |
| `echoes`          | `echo()` output                                                                                            |

`paths` is for apps that draw the result themselves. Fill `regions` with the
even-odd rule on `fill` layers, and stroke `lines`.

## parameters()

```js
import { parameters } from '@mylasertools/kerfscript';

parameters(source).parameters;
// [{ name, caption, group, type, initial, min, max, step, options, span }]
```

`type` is `"number"`, `"string"` or `"boolean"`; a list of numbers is
`"number"` with a list `initial`, as in OpenSCAD's parameter JSON. `span` is
`[start, end]`, the offsets of the value in the source, so an editor can change
a value without touching anything else:

```js
const p = parameters(source).parameters.find((p) => p.name === 'width');
const next = source.slice(0, p.span[0]) + '200' + source.slice(p.span[1]);
```

## Errors

Errors are thrown as `KerfError` with `line` and `col`. They also carry
`echoes`, the `echo()` output up to the error, and `missingFonts` when a font
was not supplied, so an app can load those fonts and render again.

```js
import { KerfError, render } from '@mylasertools/kerfscript';

try {
  render(source, { fonts });
} catch (e) {
  if (e instanceof KerfError && e.missingFonts) {
    // load e.missingFonts, then render again
  }
}
```

## Running untrusted code

Programs cannot read files or the network: `use` and `include` reach only the
standard library and whatever your `resolve` returns. Step and recursion limits
stop runaway programs. A render is still ordinary synchronous work, so run
it in a web worker, and stop the worker if it takes too long.
