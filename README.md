<p align="center">
  <a href="https://kerfscript.mylasertools.com"><img src=".github/readme/banner.png" alt="KerfScript, a programming language for laser cutting" width="840"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mylasertools/kerfscript"><img src="https://img.shields.io/npm/v/@mylasertools/kerfscript?color=d8361f&label=npm" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-AGPL--3.0%20%2B%20commercial-1f1a17" alt="Licence: AGPL-3.0 or commercial"></a>
  <a href="LANGUAGE.md"><img src="https://img.shields.io/badge/language-0.1-e3c69a" alt="Language version 0.1"></a>
  <a href="https://kerfscript.mylasertools.com/playground/"><img src="https://img.shields.io/badge/try%20it-playground-5a3519" alt="Try it in the playground"></a>
</p>

<p align="center">
  <a href="https://kerfscript.mylasertools.com">Website</a> ·
  <a href="https://kerfscript.mylasertools.com/playground/">Playground</a> ·
  <a href="https://kerfscript.mylasertools.com/models/">Models</a> ·
  <a href="https://kerfscript.mylasertools.com/docs/">Docs</a> ·
  <a href="https://www.npmjs.com/package/@mylasertools/kerfscript">npm</a>
</p>

Write a part once as code, change a number, and get a new cut file. KerfScript
is to laser cutters what OpenSCAD is to 3D printers, except it was designed for
flat parts from the start: cut, score and engrave layers, kerf compensation,
finger joints, living hinges, parts and sheets are part of the language.

<p align="center">
  <a href="https://kerfscript.mylasertools.com/playground/?model=fractal-tree"><img src=".github/readme/playground.gif" alt="Moving a slider in the playground changes the number in the code and redraws the fractal tree" width="840"></a>
  <br><sub>The <a href="https://kerfscript.mylasertools.com/playground/">playground</a> runs the interpreter in your browser. A comment after a number turns it into a slider.</sub>
</p>

## Example

<table>
<tr>
<td width="50%" valign="top">

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

</td>
<td width="50%" valign="top">
<img src=".github/readme/model-box.png" alt="Six finger-jointed panels of a box, packed on a sheet">
</td>
</tr>
</table>

```sh
npx @mylasertools/kerfscript render box.kerf -o box.svg -D width=200
```

That writes all six panels packed on a sheet, kerf compensated, as a
millimetre SVG with one layer per operation. Output is checked automatically
in Inkscape; see [docs/compatibility.md](docs/compatibility.md) for what has
and has not been tested in other laser software.

## Made with KerfScript

Every model is a file in [examples/](examples). The pictures show the cut
parts put together, built in Blender from KerfScript's own output
([site/3d](site/3d)). Open one on the website to turn it around in 3D, change
its settings and download the SVG or DXF, or copy it as the start of your own
design.

<table>
<tr>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/hadal/"><img src="site/public/3d/hadal.webp" alt="Hadal sculpture, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/hadal/">Hadal sculpture</a></b><br><sub>13 slotted parts, ribs computed from lists</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/tilt-maze/"><img src="site/public/3d/tilt-maze.webp" alt="Tilt maze, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/tilt-maze/">Tilt maze</a></b><br><sub>a new maze for every seed, by recursion</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/topo-island/"><img src="site/public/3d/topo-island.webp" alt="Layered island, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/topo-island/">Layered island</a></b><br><sub>contours traced from a height formula</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/fractal-tree/"><img src="site/public/3d/fractal-tree.webp" alt="Fractal tree, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/fractal-tree/">Fractal tree</a></b><br><sub>a module that calls itself</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/round-badge/"><img src="site/public/3d/round-badge.webp" alt="Round badge, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/round-badge/">Round badge</a></b><br><sub>text set letter by letter around a circle</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/winterlight/"><img src="site/public/3d/winterlight.webp" alt="Winterlight ornaments, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/winterlight/">Winterlight ornaments</a></b><br><sub>one-piece ornaments with scored detail</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/xenospora/"><img src="site/public/3d/xenospora.webp" alt="Xenospora seed pod, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/xenospora/">Xenospora seed pod</a></b><br><sub>16 parts on 3 sheets, one file per sheet</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/solstice/"><img src="site/public/3d/solstice.webp" alt="Solstice lantern, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/solstice/">Solstice lantern</a></b><br><sub>tabs, slots and a fit test piece</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/box/"><img src="site/public/3d/box.webp" alt="Finger-jointed box, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/box/">Finger-jointed box</a></b><br><sub>six panels from one library call</sub></td>
</tr>
<tr>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/gears/"><img src="site/public/3d/gears.webp" alt="Spur gears, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/gears/">Spur gears</a></b><br><sub>involute teeth from a formula</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/gift-tags/"><img src="site/public/3d/gift-tags.webp" alt="Gift tags from a list, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/gift-tags/">Gift tags from a list</a></b><br><sub>one tag per name, each name fitted</sub></td>
<td width="33%" valign="top"><a href="https://kerfscript.mylasertools.com/models/clock-face/"><img src="site/public/3d/clock-face.webp" alt="Clock face, assembled"></a><br><b><a href="https://kerfscript.mylasertools.com/models/clock-face/">Clock face</a></b><br><sub>cut, score and engrave in 18 lines</sub></td>
</tr>
</table>

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

The site also publishes [llms.txt](https://kerfscript.mylasertools.com/llms.txt),
a [full text bundle](https://kerfscript.mylasertools.com/llms-full.txt), and a
Markdown companion at `index.md` under every public page path. The guides and
model companions are generated from the same source as their HTML pages. Each
HTML page advertises its Markdown version with a `rel="alternate"` link.
Markdown responses point back to the matching HTML URL with a canonical HTTP
header, so the HTML page remains the preferred Search result.
The site's `robots.txt` permits all cooperating crawlers. Cloudflare's bot
controls must also allow requests to the hostname for a crawler to reach it.

```sh
npm --prefix site install
npm run site          # build KerfScript, then the site into site/dist
npm run site:serve    # preview on http://localhost:4321
npm --prefix site run deploy
npm run readme-images # redraw the model pictures in this README
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
