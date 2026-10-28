# Kerf

The laser beam burns away a thin line of material as it cuts. That width is
the **kerf**, usually somewhere between 0.05 and 0.3 mm depending on the
machine, the lens, the material and its thickness. Without compensation every
part comes out smaller than drawn by about one kerf, and every hole bigger.
For a sign that hardly matters. For finger joints and press fits it decides
whether the box holds together.

## Setting it

```kerf
$kerf = 0.15;
```

KerfScript offsets every cut outline outward by half the kerf when it writes
the file. The beam then runs half a kerf outside the part and burns away
material that was never part of it, so the part ends up the size you typed.
Holes are offset inward the same way, so they end up the size you typed too.

Only closed outlines on cut layers are offset. Engraving, scoring and open cut
lines (like a living hinge) are left as drawn.

You can set the kerf for one material only, together with its thickness:

```kerf
material(thickness = 4, kerf = 0.12, name = "birch") {
  part("side", qty = 2) finger_rect([100, 60], "out");
}
```

On the command line, `--kerf 0.1` overrides the value for every part.

## Measuring your kerf

1. Cut the [calibration square](../examples/calibration-square.kerf) with
   `$kerf = 0`.
2. Measure the outside of the square with calipers, across the middle.
3. Your kerf is `100 - measured`. If the square measures 99.82 mm, use
   `$kerf = 0.18`.
4. Cut it again with that value. The square should now be 100 mm and the hole
   20 mm. If the square is still small and the hole big, raise `$kerf` a
   little; if the square is big, lower it.

Measure each material you use. Thicker material usually has a wider kerf, and
the kerf can differ between the top and bottom face.

## Checking a fit

For joints, the [kerf and fit test](../examples/kerf-test.kerf) cuts a row of
slots from slightly narrower to slightly wider than `$thickness`. Push a scrap
of the same sheet into each slot:

- if the slot marked `0` is snug, your kerf and thickness are right;
- if a `+` slot fits best, the sheet is thicker than `$thickness` says
  (plywood often is);
- if a `-` slot fits best, it is thinner.

Set `$thickness` to the thickness you measured rather than the one on the
label, and joints follow.

## Limits

- A hole, slot or notch narrower than the kerf cannot be cut: the beam is
  wider than the gap, so compensation closes it. KerfScript warns when that
  happens to a hole.
- Thin bridges and fingers come out the right size but are fragile, and can
  char in thin material. Keep them several times wider than the kerf.
- The beam is not perfectly straight in thick material, so cut faces taper a
  little. Compensation works on the average width.
