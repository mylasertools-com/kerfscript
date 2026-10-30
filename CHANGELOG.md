# Changelog

## 0.2.1

- `kerfscript.wasm`: a WASI module that runs KerfScript from Python, Rust,
  Go, C# and other languages. It takes a JSON request on standard input and
  writes SVG, DXF, parts and warnings as JSON. Build it with `npm run wasm`;
  see [docs/webassembly.md](docs/webassembly.md).
- A desktop app for Windows, macOS and Linux: the playground with `.kerf`
  files on disk (Open, Save, Save as, double-click to open), exports through a
  save dialog, and `use`/`include` libraries read from the design's folder.
  Installers: Windows setup and MSI, a universal macOS dmg, and an AppImage,
  `.deb` and `.rpm` for Linux x64 and arm64; Flathub, winget, Chocolatey and
  AUR manifests. See [docs/desktop.md](docs/desktop.md).
- Open in LightBurn in the desktop app: sends the cut file (or one sheet) to
  LightBurn 2.2 or later through its REST API. KerfScript asks LightBurn only
  for permission to send files.
- Chocolatey and MacPorts manifests for the command line.
- Standalone `kerf` binaries for Windows, macOS and Linux that need no
  Node.js, `.deb` and `.rpm` packages, a Docker image, a snap, and Homebrew,
  Scoop, winget and AUR manifests, all built by the release workflow with
  SHA-256, SHA-512 and GPG signatures. Nightly builds go to a rolling
  `nightly` prerelease. See RELEASING.md.
- A `kerf(1)` man page and a `text/x-kerfscript` MIME type for `*.kerf` files
  in the Linux packages.
- The command line and `kerfscript.wasm` have a font built in, Atkinson
  Hyperlegible as `Atkinson` (the playground's font), so `text()` works
  without `--font`. The JavaScript library still takes fonts from the host.
- Memory limits, so a program cannot make a browser tab run out of memory:
  part copies, circle segments and polygon corners, list and string sizes,
  all list items together, `text()` length, shape points, exported points
  and sheets. Each stops the program with an error that says what to change.
  Defaults are in `DEFAULT_LIMITS` and the `limits` render option changes
  them. Every example stays well under them.
- A list or string that grows past what JavaScript can hold now gives a
  KerfScript error instead of a `RangeError`.
- Lists are checked while they are built, so `each` in a long loop, list
  arithmetic and matrix products stop at the limit instead of first filling
  memory. Strings joined with `+`, strings from functions and `echo()` text
  count toward `maxListItems` too, and a repeated unknown argument warning
  is shown once.
- The commercial licence for closed-source apps and services is free: email
  hi@mylasertools.com.

## 0.2.0 (2026-10-28)

First public release.

- `render()` returns `paths` (path data per layer), `width` and `height`, and
  every sheet has `paths`, so host apps can draw layers without parsing SVG.
  Each layer path has `d` (everything), `regions` (closed outlines, filled
  even-odd on fill layers) and `lines` (open lines, always stroked).
- `margin` render option and `--margin` flag: space between the parts and
  the sheet edge, separate from `gap` between parts (defaults to `gap`).
- Errors from a missing font carry `missingFonts`, so a host can load the
  fonts and render again.
- `parameters()` gives list settings `"type": "number"` with a list
  `initial`, the same as OpenSCAD's parameter JSON (was `"vector"`).
- Every setting has `span`, the source offsets of its value, so an editor
  can change the value without touching anything else.
- A setting's caption comes only from a comment on its own line above it,
  not from the end-of-line comment of the setting before.
- `text_width()` and `text_metrics()` errors report their line and column.
- A warning when kerf compensation closes a hole narrower than the kerf.
- `kerf check` lists every sheet with its material, thickness and pieces;
  `kerf render` warns when several sheets are stacked in one SVG, and
  `kerf --version` shows the language version too.
- Guides in `docs/`, calibration square and kerf test examples, and
  `npm run compat`, which checks SVG and DXF output in Inkscape.

## 0.1.0 (not published)

First version of the KerfScript language (language version 0.1).

- Language: numbers, strings, lists, ranges, functions and closures, list
  comprehensions, modules with children, dynamic `$` variables, `use` and
  `include`, customizer comments.
- Shapes: rect, circle, ellipse, regular_polygon, star, polygon, SVG path,
  text, line, polyline, arc.
- Booleans, hull, offset, stroke, outline and transforms.
- Laser layers (cut, score, engrave, guide, custom), parts, materials, kerf
  compensation, inner cuts first, sheet packing.
- Joinery: finger_rect, finger_holes, tslot, living_hinge; `kerf/box`.
- SVG and DXF output, `kerf` command line tool.
