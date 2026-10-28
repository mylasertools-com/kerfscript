# Parts and sheets

A design often has more than one piece. KerfScript lets you name each piece,
say how many you need and what it is cut from, and lays them out on sheets.

## Parts

```kerf
part("side", qty = 2) rect([100, 60]);
part("base") rect([100, 100]);
```

`part(name, qty = 1)` makes a named part. Everything inside it is one piece
with its own layers. Shapes outside any part form one part called `part`.

Parts show up in the part list with their size and cut length, which the
playground and `kerf check` print.

## Materials

Each part records `$thickness`, `$kerf` and `$material` where it is made.
`material()` sets all three for the parts inside it:

```kerf
material(thickness = 3, kerf = 0.15, name = "plywood") {
  part("front") rect([100, 60]);
  part("back") rect([100, 60]);
}
material(thickness = 2, kerf = 0.1, name = "acrylic") {
  part("window") rect([80, 40]);
}
```

## Sheets

With the default `$layout = "pack"`, KerfScript:

1. groups parts by material and thickness,
2. copies each part `qty` times,
3. turns a part 90° when that makes it fit,
4. packs them in rows onto sheets of `$sheet` (600 by 400 mm by default),
   with `$gap` millimetres between parts and around the edge.

A part bigger than the sheet gives a warning. With `$layout = "none"` parts
stay where your program put them.

```kerf
$sheet = [300, 200];
$gap = 4;
```

## One file per sheet

The design above makes two sheets: one of plywood and one of acrylic. The
combined SVG shows every sheet stacked one above the other, which is useful
for a preview but is **not** a cutting job: the sheets are different
materials.

Cut each sheet as its own job:

- On the command line, `--split` writes one file per sheet
  (`design-1.svg`, `design-2.svg`, ...). `kerf check` lists the sheets with
  their material and thickness.
- From JavaScript, `result.sheets` has an SVG and a DXF for each sheet, with
  its `material` and `thickness`.

Before cutting, check that each file's material and thickness match the
sheet in your machine.
