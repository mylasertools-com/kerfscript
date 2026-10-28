# Coming from OpenSCAD

KerfScript borrows OpenSCAD's syntax on purpose: if you have written
OpenSCAD, you can read KerfScript and write it within minutes. It is not a
drop-in replacement. It only makes flat parts, and a few rules are different.
OpenSCAD files do not run unchanged.

## The same

- Statements, modules, functions, `for`, `if`, `let`, `each`, list
  comprehensions, ranges like `[0:2:10]`, function literals.
- `children()`, `children(i)` and `$children`.
- Special variables that start with `$` are dynamically scoped, and `$fn`,
  `$fa` and `$fs` set curve resolution.
- 2D shapes: `square()` (also called `rect()`), `circle(r)` or `circle(d =)`,
  `polygon(points, paths)`, `text()`.
- Transforms: `translate`, `rotate`, `scale`, `mirror`, `multmatrix`.
- Combining: `union`, `difference`, `intersection`, `hull`, `offset(r)`,
  `offset(delta, chamfer)`.
- `echo()`, `assert()`, `use <...>` and `include <...>`.
- Customizer comments: `// [40:5:400]`, `/* [Group] */`, `/* [Hidden] */`,
  and captions on the line above. Tools that read OpenSCAD settings read
  these.

## Different

|             | OpenSCAD                                      | KerfScript                                                      |
| ----------- | --------------------------------------------- | --------------------------------------------------------------- |
| Output      | a solid, as STL, 3MF and more                 | a cut file, as SVG or DXF                                       |
| Dimensions  | 3D, and 2D for export                         | 2D only                                                         |
| Assignments | the last one in a scope wins everywhere in it | run in order; a later one takes effect from that line           |
| Errors      | many mistakes give `undef` and a warning      | type mistakes stop the program, naming the line                 |
| `color()`   | colours a shape                               | not available; use `cut()`, `score()`, `engrave()` or `layer()` |
| Fonts       | system fonts                                  | only fonts you pass in, so a file renders the same everywhere   |
| Libraries   | any file on disk                              | the standard library and whatever the host allows               |

## Not in KerfScript

3D modules (`cube`, `sphere`, `cylinder`, `polyhedron`,
`linear_extrude`, `rotate_extrude`, `projection`), `minkowski`, `resize`,
`color`, `import`, `surface` and `render`. Each stops with an error that
names it, so you find out at once.

## Only in KerfScript

- Layers: `cut()`, `score()`, `engrave()`, `guide()` and `layer()`.
  See [Layers](layers.md).
- Kerf compensation with `$kerf`. See [Kerf](kerf.md).
- Parts, quantities, materials and sheet packing: `part()`, `material()`,
  `$sheet`, `$gap`. See [Parts and sheets](parts-and-sheets.md).
- Joinery that reads `$thickness`: `finger_rect`, `finger_holes`, `tslot`,
  `living_hinge`.
- Lines as well as areas: `line()`, `polyline()`, `arc()`, `path()`,
  `stroke()` and `outline()`.
- Shapes OpenSCAD lacks: `ellipse`, `regular_polygon`, `star`, rounded
  `rect(r =)`.
- `text_width()` and `text_metrics()`, to size a part to its text.

## Porting a 2D design

1. Drop `linear_extrude()` and any 3D parts.
2. Replace `color()` with the layer the shape belongs on.
3. Check assignments: code that relied on a later assignment overriding an
   earlier one should assign once.
4. Pass the fonts your `text()` calls use.
5. Add `$kerf` and `$thickness`, and replace hand-made finger joints with
   `finger_rect()` if you want them to follow the material.
