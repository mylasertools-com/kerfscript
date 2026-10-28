# Changelog

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
