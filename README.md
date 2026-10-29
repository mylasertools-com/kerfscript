# KerfScript

**A programming language for laser cutting.**

[Website](https://kerfscript.mylasertools.com) ·
[Playground](https://kerfscript.mylasertools.com/playground/) ·
[Models](https://kerfscript.mylasertools.com/models/) ·
[Docs](https://kerfscript.mylasertools.com/docs/)

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

That writes all six panels packed on a sheet, kerf compensated, as a
millimetre SVG with one layer per operation. Output is checked automatically
in Inkscape; see [docs/compatibility.md](docs/compatibility.md) for what has
and has not been tested in other laser software.

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

- [Getting started](docs/getting-started.md), then the guides on
  [layers](docs/layers.md), [kerf](docs/kerf.md),
  [parts and sheets](docs/parts-and-sheets.md), [settings](docs/customizer.md),
  the [command line](docs/cli.md) and the [JavaScript API](docs/javascript.md)
- [Coming from OpenSCAD](docs/openscad.md): what is the same and what is not
- [LANGUAGE.md](LANGUAGE.md): the full language reference
- [Versions](docs/versions.md): language and package versions, and what stays
  stable before 1.0
- [examples/](examples): every model on the website, including a
  calibration square and a kerf test

## Website

kerfscript.mylasertools.com is an Astro site in [site/](site), deployed to
Cloudflare as a static assets Worker. Every model picture and the guides are
built from [examples/](examples), [docs/](docs) and LANGUAGE.md by this
version of KerfScript.

```sh
npm --prefix site install
npm run site          # build KerfScript, then the site into site/dist
npm run site:serve    # preview on http://localhost:4321
npm --prefix site run deploy
```

## Checking output

`npm run compat` renders a reference set of models and opens every SVG and
DXF in Inkscape to check sizes, layers and fills.

## Community

Bug reports, cut reports and ideas are welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](ROADMAP.md),
[SECURITY.md](SECURITY.md) and the [code of conduct](CODE_OF_CONDUCT.md).

## Licence

Copyright (c) 2026 MyLaserTools.

KerfScript is free software under the
[GNU AGPL 3.0](LICENSE), with an [additional permission](COMMERCIAL-LICENSE.md#additional-permission-your-designs-are-yours)
that makes **your `.kerf` designs and the files KerfScript generates yours to
license and sell however you like**.

A [commercial licence](COMMERCIAL-LICENSE.md) is available for proprietary
integrations or different terms. Private changes do not require one; see
[what the AGPL means for you](COMMERCIAL-LICENSE.md#what-the-agpl-means-for-you)
for how it applies to hosted services.

"KerfScript" is a trademark of MyLaserTools; see [TRADEMARKS.md](TRADEMARKS.md).
Contributions need the [CLA](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).
Bundled third-party code is listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
