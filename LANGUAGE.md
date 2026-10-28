# KerfScript language reference

Language version 0.1. Copyright (c) 2026 MyLaserTools. This document is
licensed under [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/).
"KerfScript" is a trademark of MyLaserTools, see [TRADEMARKS.md](TRADEMARKS.md).

KerfScript describes flat parts for laser cutting. A program is a list of
statements that build 2D shapes, put them on **layers** (cut, score, engrave),
group them into **parts**, and the renderer compensates for the **kerf**, packs
parts onto **sheets** and writes SVG or DXF.

Units are millimetres and degrees. The y axis points up.

```kerf
// A coaster with a hole, an engraved ring and a scored border.

size = 90; // [60:5:120]

difference() {
  circle(d = size);
  circle(d = 6);
}
engrave() difference() { circle(d = size - 16); circle(d = size - 22); }
score() circle(d = size - 6);
```

## Lexical structure

- Comments: `// line` and `/* block */`.
- Numbers: `12`, `0.5`, `.5`, `1e3`.
- Strings: `"text"` with `\n`, `\t`, `\"`, `\\` and `\uXXXX` escapes.
- Names: letters, digits and `_`, not starting with a digit. Names starting
  with `$` are **special variables** (see Scope).
- Keywords: `module function if else for let each use include true false undef`.

## Values

| Type     | Examples                                                     |
| -------- | ------------------------------------------------------------ |
| number   | `3`, `-0.25`, `PI`                                           |
| string   | `"Oak"`                                                      |
| boolean  | `true`, `false`                                              |
| undef    | `undef`, a missing argument, an index past the end of a list |
| list     | `[1, 2]`, `[[0, 0], [10, 0], [5, 8]]`                        |
| range    | `[0:5]` (0 to 5 step 1), `[0:2:10]` (0 to 10 step 2)         |
| function | `function(x) x * 2`                                          |

Points are lists `[x, y]`. `p.x` and `p.y` read the first two items.

## Expressions

From lowest to highest precedence:

| Operator            | Meaning                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `c ? a : b`         | conditional                                                                                                    |
| `\|\|`              | or                                                                                                             |
| `&&`                | and                                                                                                            |
| `==` `!=`           | equality, lists compare item by item                                                                           |
| `<` `<=` `>` `>=`   | compare numbers or strings                                                                                     |
| `+` `-`             | add or subtract numbers or equal length lists; `+` joins strings                                               |
| `*` `/` `%`         | multiply, divide, remainder; list times number scales; list times list is the dot product; matrix times vector |
| `-x` `!x`           | negate, not                                                                                                    |
| `a ^ b`             | power, right associative and tighter than unary minus                                                          |
| `f(x)` `a[i]` `a.x` | call, index, member                                                                                            |

Mixing types an operator can't handle (a list plus a number, `undef + 1`)
stops the program with an error naming the line. Truthiness: `false`, `0`,
`""`, `[]` and `undef` are false.

`let (a = 1, b = a + 1) expr` binds names for one expression.

### List comprehensions

```kerf
squares = [for (i = [1:5]) i * i];
odd = [for (i = [1:9]) if (i % 2) i];
grid = [for (x = [0:2], y = [0:2]) [x * 10, y * 10]];
flat = [each [1, 2], 3];
```

## Statements

```kerf
name = expr;                          // assignment
function name(a, b = 2) = expr;       // function
module name(a, b = 2) { ... }         // module (makes shapes)
name(args) child;                     // module call with one child
name(args) { child; child; }          // module call with a block of children
for (i = range_or_list, j = ...) ...  // repeats, combined as a union
if (cond) ... else ...
let (a = 1) ...
use <path>                            // import modules and functions
include <path>                        // run another file in place
```

Arguments can be positional or named: `rect([20, 10], r = 2)`.

### Scope

- Assignments run **in order**. A later assignment to the same name replaces
  the earlier one from that point on.
- `module` and `function` definitions are visible in their whole block, so you
  can call them before they are defined.
- Blocks, loops and module bodies have their own scope.
- **Special variables** (`$name`) are dynamically scoped: a value set by a
  caller is seen by everything it calls. Pass them as arguments too:
  `circle(5, $fn = 6)`.
- Top-level assignments are the program's **parameters**. Renderers override
  them by name (`kerf render -D width=200`).

### Modifiers

Put before a module call: `*` disables it, `#` and `%` move it to the guide
layer so you can see it without cutting it.

### children()

Inside a module, `children()` renders the statements the module was called
with, `children(i)` renders only the i-th one, and `$children` is their count.

```kerf
module hang_hole(d = 5) {
  difference() { children(); translate([0, -d * 1.5]) circle(d = d); }
}
```

## Special variables

| Name              | Default       | Meaning                                                                    |
| ----------------- | ------------- | -------------------------------------------------------------------------- |
| `$thickness`      | `3`           | material thickness, used by joinery and stored on parts                    |
| `$kerf`           | `0`           | beam width; cut outlines are offset by half of it                          |
| `$material`       | `"material"`  | material name; parts are packed per material and thickness                 |
| `$sheet`          | `[600, 400]`  | sheet size for packing                                                     |
| `$gap`            | `3`           | space between packed parts and around the sheet edge                       |
| `$layout`         | `"pack"`      | `"pack"` packs parts onto sheets, `"none"` keeps your placement            |
| `$fn` `$fa` `$fs` | `0` `2` `0.2` | curve resolution: fixed segment count, or max angle and max segment length |
| `$font`           |               | default font name for `text()`                                             |

## Layers

Every shape is on a layer. Shapes not wrapped in a layer module are on `cut`.

| Layer     | Mode  | Colour    | What happens                                         |
| --------- | ----- | --------- | ---------------------------------------------------- |
| `engrave` | fill  | `#000000` | the area is engraved                                 |
| `score`   | line  | `#0000ff` | lines and shape outlines are marked, not cut through |
| `cut`     | cut   | `#ff0000` | outlines are cut through, with kerf compensation     |
| `guide`   | guide | `#00a0ff` | shown only when guides are requested                 |

```kerf
cut() ...        engrave() ...        score() ...        guide() ...
layer("pocket", mode = "fill", color = "#00aa00") ...
```

`layer(name, mode, color)` defines a layer. Modes are `"cut"`, `"line"`,
`"fill"` and `"guide"`. Output lists layers as engrave, custom layers, score,
cut, guide, so machines engrave before cutting.

Rules applied when a part is finished:

- The part's **material** is the union of its cut layer shapes.
- Engrave, score and custom layers are clipped to the material, so nothing is
  marked inside holes or off the part. Score outlines become lines first.
- Cut lines (from `line()`, `living_hinge()` and similar) are clipped to the
  material.
- If the material breaks into more than one piece, the renderer warns.
- In the output, holes and inner cuts come before outer outlines.

## Parts and sheets

```kerf
material(thickness = 4, kerf = 0.12, name = "birch") {
  part("side", qty = 2) finger_rect([100, 60], "out");
  part("base") rect([100, 100]);
}
```

- `part(name, qty = 1) { ... }` makes a named part. It records `$thickness`,
  `$kerf` and `$material` where it is called.
- Shapes outside any part form one part named `part`.
- `material(thickness, kerf, name) { ... }` sets those special variables for
  its children.
- With `$layout = "pack"` parts are grouped by material and thickness, copied
  `qty` times, rotated 90° if that makes them fit, and shelf-packed onto
  sheets of `$sheet`. Parts larger than the sheet are reported.

## Built-in modules

### Shapes

| Module                                                     | Notes                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `rect(size, center = false, r = 0)`                        | `size` is a number or `[w, h]`; `r` rounds the corners. `square` is an alias |
| `circle(r)` or `circle(d = ...)`                           |                                                                              |
| `ellipse([rx, ry])`                                        |                                                                              |
| `regular_polygon(n, r)`                                    | corner radius `r`                                                            |
| `star(n, r, inner)`                                        |                                                                              |
| `polygon(points, paths)`                                   | even-odd fill, `paths` lists point indexes per outline                       |
| `path(d, fill = "evenodd")`                                | SVG path data; closed subpaths become shapes, open ones lines                |
| `text(text, size = 10, font, halign, valign, spacing = 1)` | `halign`: left, center, right; `valign`: baseline, top, center, bottom       |
| `line(from, to)`                                           | a line, not an area                                                          |
| `polyline(points, closed = false)`                         |                                                                              |
| `arc(r, start = 0, end = 90)`                              | arc line, angles in degrees                                                  |

### Transforms

`translate([x, y])`, `rotate(a, center = [x, y])`, `scale(s)` or
`scale([sx, sy])`, `mirror([nx, ny])` (mirror across the line through the
origin with that normal), `multmatrix(m)` with a 2x3 matrix.

### Combining

| Module                                         | Notes                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `union()` / `group()`                          | joins children                                                             |
| `difference()`                                 | removes every later child's area from every layer of the first child       |
| `intersection()`                               | keeps only the area common to all children, layers of the first child kept |
| `hull()`                                       | convex hull                                                                |
| `offset(r)` / `offset(delta, chamfer = false)` | grow (positive) or shrink areas; `r` rounds corners                        |
| `stroke(width)`                                | turns lines into areas of that width, for cutting single line art          |
| `outline()`                                    | turns areas into their outline lines                                       |

### Joinery

| Module                                               | Notes                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finger_rect(size, edges, finger)`                   | rectangle with finger joints. `edges` is one value or `[bottom, right, top, left]`, each `"out"`, `"in"` or `"flat"`. An `"out"` edge keeps its corners, an `"in"` edge notches them; join an `"out"` edge to an `"in"` edge of the same length. Notch depth is `$thickness`; `finger` defaults to `max(3 * $thickness, 6)` and the count is always odd |
| `finger_holes(length, edge = "out", finger)`         | row of slots along x, centred on y = 0, that an `edge` finger edge of the same length plugs into (for shelves and dividers)                                                                                                                                                                                                                             |
| `tslot(d = 3, length = 12, nut = [w, h], nut_at)`    | T-slot for a screw and nut, opening at y = 0 and running up; subtract it from a panel edge                                                                                                                                                                                                                                                              |
| `living_hinge(size, spacing = 1.5, bridge = 3, cut)` | straight-line flex pattern as cut lines filling `[w, h]`                                                                                                                                                                                                                                                                                                |

### Other

`echo(...)` prints values, `assert(cond, message)` stops with the message when
`cond` is false, `children(i)`.

## Built-in functions

Math (degrees): `abs sign floor ceil round sqrt pow exp ln log sin cos tan
asin acos atan atan2 min max clamp lerp norm cross`.

Lists and strings: `len concat reverse sum slice str chr ord upper lower split
join search contains lookup`.

Types: `is_num is_string is_bool is_list is_undef is_function type_of`.

Random: `rands(min, max, count, seed)` is repeatable for the same seed.

Text: `text_width(text, size, font)` returns the advance width;
`text_metrics(text, size, font)` returns `[advance, [[x0, y0], [x1, y1]], ascent, descent]`.

Joinery: `finger_count(length, finger)` returns the finger count
`finger_rect` uses for that edge.

## Customizer comments

Top-level assignments with a plain value (number, string, boolean or list of
numbers) are listed as parameters by `kerf params` and by editors:

```kerf
/* [Size] */             // group for the following parameters
// Outer width           <- caption: the comment line above
width = 120; // [40:5:400]   min:step:max
depth = 80;  // [200]        max
shape = "round"; // [round:Round, square:Square]   choices with labels
count = 3; // [2, 3, 4]      choices
/* [Hidden] */           // not listed
```

The format matches OpenSCAD customizer comments, so existing editors can show
KerfScript parameters.

## Standard library

`use <kerf/box>`:

- `box([w, d, h], lid = false, finger)` makes the six (or five) panels of a
  finger-jointed box as parts `bottom`, `lid`, `front`, `back`, `left`,
  `right`. Sizes are outer sizes.
- `divider([w, h], finger)` makes a divider with finger tabs on both sides.

## Output

- **SVG**: millimetre units, one Inkscape layer group per KerfScript layer,
  colours as above, 0.1 mm hairline strokes, `data-part` on every path.
- **DXF**: R12 (AC1009) polylines on layers named after KerfScript layers,
  with matching AutoCAD colours.

## Limits

Renderers stop programs that recurse deeper than about a thousand calls, loop
over more than a million items, or run more than five million steps, with an
error instead of hanging.
