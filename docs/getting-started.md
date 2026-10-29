# Getting started

Make a small sign with two hanging holes and engraved text. You can follow
this guide in the [playground](https://kerfscript.mylasertools.com/playground/)
without installing anything.

## Your first part

Clear the playground editor and enter:

```kerf
rect([80, 50], r = 4);
```

This draws an 80 × 50 mm rectangle with 4 mm corner radii. KerfScript uses
millimetres for lengths and degrees for angles. Shapes go on the cut layer
unless you assign another layer.

## Holes

Replace the rectangle with this code:

```kerf
difference() {
  rect([80, 50], r = 4);
  translate([10, 25]) circle(d = 5);
  translate([70, 25]) circle(d = 5);
}
```

`difference()` subtracts the two circles from the rectangle. Each hole is
5 mm across, centred 10 mm from a side and halfway up the sign.

`translate([x, y])` moves a shape. The x axis points right and the y axis
points up. A rectangle starts at `[0, 0]`; use `center = true` to centre it
on that point.

## Engraving and scoring

Add a scored border and engraved text:

```kerf
difference() {
  rect([80, 50], r = 4);
  translate([10, 25]) circle(d = 5);
  translate([70, 25]) circle(d = 5);
}
score() translate([20, 10]) rect([40, 30], r = 2);
engrave() translate([40, 25])
  text("Oak", size = 10, halign = "center", valign = "center");
```

`score()` marks the border's outline. `engrave()` fills the letters. Both
stay within the sign's cut outline, excluding the holes. The playground
supplies a font for this example.

See [Layers](layers.md) for custom layers and guide lines.

## Settings

Give dimensions names so you can change them without editing every shape:

```kerf
width = 80; // [40:5:200]
height = 50; // [30:5:120]
label = "Oak";

difference() {
  rect([width, height], r = 4);
  translate([10, height / 2]) circle(d = 5);
  translate([width - 10, height / 2]) circle(d = 5);
}
engrave() translate([width / 2, height / 2])
  text(label, size = 10, halign = "center", valign = "center");
```

The comments create sliders for width and height. `[40:5:200]` means a
minimum of 40, a step of 5 and a maximum of 200. `label` becomes a text
field. The text and holes stay centred as the dimensions change.

In the playground, changing a control also updates its value in the code.
See [Settings](customizer.md) for menus, groups and captions.

## Kerf

The beam removes some material along each cut. To account for that width,
add your measured kerf near the top of the program:

```kerf
$kerf = 0.15;
```

Here, `0.15` is an example in millimetres. Use the
[calibration square](../examples/calibration-square.kerf) to measure a value
for your machine and material. [Kerf](kerf.md) explains the measurement and
how it affects the exported outlines.

## Getting the file

Choose **SVG** or **DXF** in the playground, then open the file in your laser
software. Assign the cut, score and engrave layers their power, speed and
operation order. In DXF, set engraved areas to fill.

If you used `$kerf`, leave kerf compensation off in the laser software to
avoid applying it twice. The [import guide](compatibility.md) covers sizes,
layers and tested programs.

Download **.kerf** to keep an editable copy of the design.

## Next

- [Layers](layers.md): separate cutting, scoring and engraving.
- [Parts and sheets](parts-and-sheets.md): arrange several parts by material.
- [Coming from OpenSCAD](openscad.md): adapt an existing 2D design.
- [Language reference](../LANGUAGE.md): look up syntax and functions.
