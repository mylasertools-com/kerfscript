# Layers

Layers separate cutting, scoring and engraving in the exported file. Use
them to give different parts of a design different operations in your laser
software. Unassigned shapes go on the `cut` layer.

## The built-in layers

| Layer | Wrap shapes in | Colour in the file | Intended operation |
| --- | --- | --- | --- |
| `engrave` | `engrave()` | black `#000000` | Fill an area |
| `score` | `score()` | blue `#0000ff` | Mark a line or outline |
| `cut` | `cut()` | red `#ff0000` | Cut through the material |
| `guide` | `guide()` | light blue | Show construction geometry |

This coaster has a cut outline and hole, an engraved ring and a scored border:

```kerf
difference() {
  circle(d = 90);
  circle(d = 6);
}
engrave() difference() { circle(d = 74); circle(d = 68); }
score() circle(d = 84);
```

The layer describes the operation. Set its power, speed and passes in your
laser software.

Place `#` or `%` before a module call to move it to the guide layer.
Guides are excluded from the output unless you request them with
`--guides` on the command line or `guides: true` in the API.

## Areas and lines

Shapes such as `rect()`, `circle()` and `text()` define areas. On an
engrave layer, those areas are filled. On cut and score layers, their
outlines become paths.

`line()`, `polyline()`, `arc()` and `living_hinge()` produce lines. They
remain lines on every layer. A living hinge, for example, is a pattern of
open cuts within a part.

Use `stroke(width)` to turn a line into an area of a specified width. Use
`outline()` to turn an area's boundary into lines.

## The material

Closed shapes on a part's cut layer define its material. KerfScript clips
engraving, scoring and open cut lines to that area, excluding holes. Start
with a cut shape when adding marks to a part.

If the cut shapes form separate pieces, KerfScript reports a warning. Check
for a missing connection or define the pieces as separate parts.

## Your own layers

Use `layer(name, mode, color)` when you need another operation, such as a
second engraving depth:

```kerf
rect([60, 40]);
layer("deep", mode = "fill", color = "#00aa00")
  translate([10, 10]) rect([20, 20]);
engrave() translate([40, 20]) circle(d = 12);
```

The rectangle and circle use separate engraving layers. You can assign each
a different power in your laser software. Supported modes are `"cut"`,
`"line"`, `"fill"` and `"guide"`.

## Order in the file

KerfScript writes layers in this order: engrave, custom layers, score, cut,
then guide. Within a cut layer, inner paths precede outer outlines.

Laser software may reorder these paths. Check its job preview so engraving
runs before cutting and holes are cut before the surrounding part.
