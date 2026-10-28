# KerfScript

**A programming language for laser cutting.**

Write a part once as code, change a number, and get a new cut file. KerfScript
is to laser cutters what OpenSCAD is to 3D printers, except it was designed for
flat parts from the start: cut, score and engrave layers, kerf compensation,
finger joints, living hinges, parts and sheets are part of the language.

```kerf
use <kerf/box>

/* [Size] */
width = 120; // [40:5:400]
depth = 80; // [40:5:400]
height = 50; // [20:5:300]
lid = true;

/* [Material] */
$thickness = 3; // [1.5:0.5:10]
$kerf = 0.15; // [0:0.01:0.5]

box([width, depth, height], lid = lid);
```

```sh
npx @mylasertools/kerfscript render box.kerf -o box.svg -D width=200
```

That writes all six panels packed on a sheet, kerf compensated, with red cut
lines that LightBurn, xTool Creative Space, Inkscape and RDWorks read directly.

## Why a new language

- **Laser concepts are built in.** `engrave()`, `score()` and `cut()` put
  geometry on machine layers. Engraving is clipped to the material, inner
  cuts come before outer ones, and the whole part is offset by half the kerf.
- **Parts, not just shapes.** `part("lid", qty = 2)` names a piece; the
  renderer packs parts by material and thickness onto sheets.
- **Joinery that fits.** `finger_rect`, `finger_holes`, `tslot` and
  `living_hinge` use `$thickness`, so changing the material keeps joints
  tight.
- **Familiar syntax.** If you know OpenSCAD, you can read KerfScript. The
  customizer comments are the same, so editors that understand OpenSCAD
  parameters understand KerfScript ones.
- **Runs anywhere.** Pure TypeScript with no native code: the same interpreter
  runs in browsers, Node, workers and the command line.
- **Safe to run.** Programs read libraries only through the resolver you
  provide. Step and recursion limits stop runaway programs, and errors name
  the line.

## Install

```sh
npm install @mylasertools/kerfscript
```

## Command line

```sh
kerf render design.kerf -o design.svg      # or .dxf / .json
kerf render design.kerf -D width=200 -D 'label="Oak"' --font Inter.ttf
kerf render design.kerf --sheet 400x300 --kerf 0.1 --split
kerf params design.kerf                    # customizer parameters as JSON
kerf check design.kerf                     # parts, sizes, cut length, warnings
```

## Library

```js
import { render, parameters } from '@mylasertools/kerfscript';

const result = render(source, {
  params: { width: 200 },
  fonts: { inter: await (await fetch('/Inter.ttf')).arrayBuffer() },
  sheet: [600, 400],
});

result.svg; // all sheets in one SVG
result.sheets; // [{ width, height, material, thickness, svg, dxf, items }]
result.parts; // [{ name, qty, width, height, pieces, cutLength, thickness, kerf, material }]
result.warnings; // e.g. a part that falls apart, or one bigger than the sheet
result.echoes; // echo() output

parameters(source).parameters; // [{ name, caption, group, type, initial, min, max, step, options, span }]
```

Errors are thrown as `KerfError` with `line` and `col`.

## Learn the language

- [LANGUAGE.md](LANGUAGE.md): the full language reference
- [examples/](examples): a box, a living hinge card, a name sign sized to
  its text

## Website

The site for kerfscript.mylasertools.com lives in [site/](site). `npm run site`
builds it into `site/dist` (every model picture is rendered from
[examples/](examples) by this version of KerfScript), and `npm run site:serve`
serves it on http://127.0.0.1:4321 for a look before publishing.

## Licence

Copyright (c) 2026 MyLaserTools.

KerfScript is free software under the
[GNU AGPL 3.0](LICENSE), with an [additional permission](COMMERCIAL-LICENSE.md#additional-permission-your-designs-are-yours)
that makes **your `.kerf` designs and the files KerfScript generates yours to
license and sell however you like**.

Using KerfScript in a closed source product or hosted service without
publishing your source requires a [commercial licence](COMMERCIAL-LICENSE.md).

"KerfScript" is a trademark of MyLaserTools; see [TRADEMARKS.md](TRADEMARKS.md).
Contributions need the [CLA](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).
Bundled third-party code is listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
