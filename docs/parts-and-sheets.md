# Parts and sheets

Use parts to name the pieces in a design, set quantities and assign
materials. KerfScript lays them out on sheets, grouping parts that use the
same material and thickness.

## Parts

```kerf
part("side", qty = 2) rect([100, 60]);
part("base") rect([100, 100]);
```

This creates two side panels and one base. Each `part()` has its own layers
and appears in the parts list with dimensions and cut length. The default
quantity is one.

Shapes outside a `part()` are collected into a part named `part`.

Transforms and operations such as `translate()`, `difference()` and
`offset()` can wrap a part and change all of it. Layer wrappers such as
`score()` and `engrave()` go inside the part instead, since a whole part on
the score layer would have nothing to cut:

```kerf
part("tag") {
  rect([60, 30], r = 3);
  score() translate([5, 5]) rect([50, 20]);
}
```

## Assembly

Give a part a place in 3D and apps can show the design put together.
`rotate` turns the part and `at` moves it. The turn happens first, the same
as OpenSCAD's `translate(at) rotate(r)`. Each part is drawn flat with its
thickness standing up along +Z.

```kerf
material(thickness = 3) {
  part("base", at = [0, 0, 0]) rect([100, 60]);
  part("wall", at = [0, 3, 3], rotate = [90, 0, 0]) rect([100, 40]);
}
```

A part with copies takes one placement for all of them, or a list with one
for each copy:

```kerf
part("leg", qty = 4, at = [[0, 0, 0], [80, 0, 0], [0, 40, 0], [80, 40, 0]],
     rotate = [90, 0, 0]) rect([20, 60]);
```

`box()` from `kerf/box` places its panels itself, so every box assembles.
Parts without `at` or `rotate` lie flat beside the assembled view, each copy
in rows to its right, and the render names them in a warning. When placed
parts run into each other, the render warns which two collide. That is what
a finger edge set to `"out"` where it should be `"in"` looks like, or a part
placed one thickness off. Joints that interlock exactly do not count, and
neither does an overlap smaller than about a cubic millimetre, the kind of
nick a laser kerf or a press fit takes up. A tab half a millimetre out of its
slot is well over that and gets a warning.

## Materials

`material()` sets the thickness, kerf and material name for its parts:

```kerf
material(thickness = 3, kerf = 0.15, name = "plywood") {
  part("front") rect([100, 60]);
  part("back") rect([100, 60]);
}
material(thickness = 2, kerf = 0.1, name = "acrylic") {
  part("window") rect([80, 40]);
}
```

The two plywood panels share a sheet. The acrylic window goes on a separate
sheet. Each part records the `$thickness`, `$kerf` and `$material` values in
effect where it is defined.

## Sheets

Set the available sheet size and spacing in millimetres:

```kerf
$sheet = [300, 200];
$gap = 4;
```

With the default `$layout = "pack"`, KerfScript arranges copies of each part
in rows, leaving the specified gap. It rotates a part 90° if that lets it
fit the sheet. The default sheet is 600 × 400 mm, with a 3 mm gap between
parts and at the sheet edges.

A part larger than the sheet produces a warning. Set `$layout = "none"`
to keep the positions from your code instead of packing the parts.

The CLI `--margin` option and API `margin` option let you set the edge
spacing separately from the gap between parts.

## One file per sheet

A combined SVG stacks all sheets in one preview. For the material example
above, export the plywood and acrylic sheets separately and cut each with
the matching material settings.

- On the command line, add `--split` to write `design-1.svg`,
  `design-2.svg` and so on. `kerf check` lists each sheet's material and
  thickness.
- In JavaScript, `result.sheets` provides the SVG, DXF, material and
  thickness for each sheet.

DXF exports contain one sheet per file.
