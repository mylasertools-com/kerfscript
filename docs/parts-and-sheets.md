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
