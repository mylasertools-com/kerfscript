# Laser software

KerfScript writes ordinary SVG and DXF files, so any program that reads
those can open them. This page says what we have actually checked, in which
version, and what you still need to set up yourself.

## What is in the files

**SVG**

- Size in millimetres (`width="100mm"`), with a matching `viewBox`, so one
  unit is one millimetre.
- One group per layer, marked as an Inkscape layer and named after it:
  `engrave`, your own layers, `score`, `cut`, `guide`.
- Cut lines red `#ff0000`, score lines blue `#0000ff`, 0.1 mm hairline
  strokes. Engraved areas are filled black `#000000` with the even-odd rule.
- Holes and inner cuts come before outer outlines.

**DXF**

- R12 (AC1009) polylines, units set to millimetres.
- One DXF layer per KerfScript layer, in capitals (`CUT`, `SCORE`,
  `ENGRAVE`), with matching AutoCAD colours.
- DXF R12 has no fills. Engraved areas arrive as outlines; set that layer to
  fill in your laser software.
- A DXF holds one sheet. Use `--split` for designs with several sheets.

## Checked

| Program  | Version | SVG | DXF | How                         |
| -------- | ------- | --- | --- | --------------------------- |
| Inkscape | 1.4.2   | yes | yes | automatic, `npm run compat` |

`npm run compat` renders six reference models (the calibration square, the
kerf test, a six-panel finger-jointed box, a living hinge card, a coaster
with an engraved ring, and a jigsaw puzzle), opens every SVG and DXF in
Inkscape from the command line, and checks that:

- the size of the drawing matches KerfScript's geometry within 0.02 mm,
  kerf compensation included;
- every layer arrives as a layer with the right name;
- engraved layers are filled in the SVG.

All six passed in both formats on 28 October 2026.

## Not checked yet

We have not yet run the reference set through **LightBurn**, **xTool
Studio** or **xTool Creative Space**, **RDWorks** or **LaserGRBL**, and we
have not cut it on machines outside MyLaserTools. Until we have, treat them as
untested: they read standard SVG and DXF, but each imports colours, layers
and fills its own way.

If you try one, we would like to hear what happened. The checklist below is
what we look at.

## Checklist for a new program

Open `calibration-square.svg` and `box.svg` from the
[models](https://kerfscript.mylasertools.com/models/) and check:

1. **Size.** The square is 100.15 mm wide with the default 0.15 mm kerf
   (100 mm plus compensation), not 26.4 mm or 377.95 mm. If it is wrong, the
   program ignored the millimetre units; look for an import DPI or unit
   setting.
2. **Layers.** Cut, score and engrave arrive as separate layers or colours,
   so each can get its own power and speed.
3. **Fill.** The engraved text on the square is filled, not just outlined.
4. **Holes.** The hole in the square is cut, and engraving does not appear
   inside it.
5. **Order.** The program's cut order cuts holes before outlines. Most
   programs have an "inner shapes first" option; turn it on.
6. **Parts.** All six box panels arrive, none overlapping.

## What the file does not decide

The file describes geometry and layers. Your laser software decides how the
machine runs it:

- **Order of operations.** Layer order in an SVG is a hint. Most programs
  sort operations themselves; check that engraving runs before cutting and
  inner cuts before outer ones.
- **Power, speed, passes and focus** for each layer and material.
- **Material and thickness.** KerfScript records them per sheet; make sure
  the file you send matches the sheet in the machine.
- **Kerf.** If your laser software also applies kerf offset, turn one of them
  off, or parts will be compensated twice.

Always run a test on scrap before cutting good material.
