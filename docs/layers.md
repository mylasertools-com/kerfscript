# Layers

Every shape in KerfScript is on a layer, and the layer decides what the
laser does with it. Shapes that are not wrapped in a layer module are on
`cut`.

## The built-in layers

| Layer     | Wrap shapes in | Colour in the file | What the laser does                               |
| --------- | -------------- | ------------------ | ------------------------------------------------- |
| `engrave` | `engrave()`    | black `#000000`    | engraves the area of the shapes                   |
| `score`   | `score()`      | blue `#0000ff`     | marks lines and outlines without cutting through  |
| `cut`     | `cut()`        | red `#ff0000`      | cuts the outlines through, with kerf compensation |
| `guide`   | `guide()`      | light blue         | nothing; shown only when you ask for guide lines  |

```kerf
difference() {
  circle(d = 90);
  circle(d = 6);
}
engrave() difference() { circle(d = 74); circle(d = 68); }
score() circle(d = 84);
```

`#` and `%` in front of a module call move it to the guide layer, which is
handy for checking where something is without cutting it.

## Areas and lines

Layers hold two kinds of geometry:

- **Areas** come from shapes like `rect()`, `circle()` and `text()`. On
  `engrave` the area is filled; on `cut` and `score` its outline is followed.
- **Lines** come from `line()`, `polyline()`, `arc()` and `living_hinge()`.
  They are followed as they are, on any layer. On `cut` they are cut through,
  which is how a living hinge is made.

`stroke(width)` turns lines into areas, for engraving a line of a given
width. `outline()` turns areas into their outline lines.

## The material

When a part is finished, KerfScript takes the union of everything on the cut
layer as the **material**. Then:

- engraving and scoring are clipped to the material, so nothing is marked
  inside a hole or off the part;
- cut lines are clipped to the material too;
- if the material falls apart into separate pieces, you get a warning,
  because that usually means a missing bridge.

## Your own layers

`layer(name, mode, color)` makes a layer of your own, for example a second
engraving pass at a different power:

```kerf
rect([60, 40]);
layer("deep", mode = "fill", color = "#00aa00") translate([10, 10]) rect([20, 20]);
engrave() translate([40, 20]) circle(d = 12);
```

Modes are `"cut"`, `"line"` (score), `"fill"` (engrave) and `"guide"`.

## Order in the file

Layers are written in this order: engrave, your own layers, score, cut,
guide. Within the cut layer, holes and inner cuts come before outer outlines,
so a part does not drop out before its holes are cut.

That order is a good default, but it does not control your machine. Most
laser software sorts and orders operations itself. Check the cut order, and
set power, speed and passes for each layer, in your laser software before you
run the job.
