# Getting started

This guide takes you from an empty file to a cut file in about ten minutes.
You need nothing installed: the [playground](https://kerfscript.mylasertools.com/playground/)
runs KerfScript in your browser.

## Your first part

Open the playground, clear the editor and type:

```kerf
rect([80, 50], r = 4);
```

That is a rounded rectangle, 80 by 50 mm. Units are always millimetres. A
shape that is not on any other layer is **cut**, so this is a part you could
cut out now.

## Holes

`difference()` keeps the first shape and removes the rest from it:

```kerf
difference() {
  rect([80, 50], r = 4);
  translate([10, 25]) circle(d = 5);
  translate([70, 25]) circle(d = 5);
}
```

`translate([x, y])` moves what follows it. The y axis points up, and
`rect()` starts at `[0, 0]` unless you pass `center = true`.

## Engraving and scoring

Wrap shapes in `engrave()` to engrave their area, or `score()` to mark their
outline without cutting through:

```kerf
difference() {
  rect([80, 50], r = 4);
  translate([10, 25]) circle(d = 5);
  translate([70, 25]) circle(d = 5);
}
score() translate([20, 10]) rect([40, 30], r = 2);
engrave() translate([40, 25]) text("Oak", size = 10, halign = "center", valign = "center");
```

Engraving and scoring are clipped to the material, so nothing is marked over
a hole or off the edge. [Layers](layers.md) explains the rest.

## Settings

A top-level variable with a comment in square brackets becomes a slider:

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

Move a slider in the playground and the number in the code changes with it.
[Settings](customizer.md) covers groups, captions and menus.

## Kerf

The laser burns away a thin line of material, the **kerf**. Tell KerfScript
how wide it is and parts come out the size you typed:

```kerf
$kerf = 0.15;
```

Cut the [calibration square](../examples/calibration-square.kerf) once to
measure yours. [Kerf](kerf.md) explains how.

## Getting the file

In the playground, press **SVG** or **DXF**. Open the SVG in your laser
software: cut lines are red, score lines blue and engraving black, each on its
own layer. Set power, speed and the order of operations there, as you would
for any other file. [Laser software](compatibility.md) has notes for the
programs we have checked.

## Next

- [Layers](layers.md): cut, score, engrave and your own layers
- [Parts and sheets](parts-and-sheets.md): several pieces, quantities, materials
- [Coming from OpenSCAD](openscad.md): what is the same and what is not
- [Language reference](../LANGUAGE.md): everything in one page
