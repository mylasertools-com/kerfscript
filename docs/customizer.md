# Settings

Top-level variables with a plain value become **settings**: sliders, menus,
checkboxes and text boxes in the playground, on MyLaserTools, and in any tool
that reads OpenSCAD customizer comments. The format is the same as
OpenSCAD's.

```kerf
/* [Size] */
// Outer width
width = 120; // [40:5:400]
// Outer depth
depth = 80; // [200]

/* [Style] */
shape = "round"; // [round:Round, square:Square]
holes = 3; // [2, 3, 4]
lid = true;
label = "Tools";

/* [Hidden] */
wall = 3;

rect([width, depth]);
```

## What becomes a setting

A top-level assignment whose value is a number, a string, `true` or `false`,
or a list of numbers. An expression like `width / 2` is not a setting; it is
worked out from the others.

## Comments

| Comment after the value           | Control                       |
| --------------------------------- | ----------------------------- |
| `// [40:5:400]`                   | slider from 40 to 400, step 5 |
| `// [40:400]`                     | slider from 40 to 400         |
| `// [200]`                        | number up to 200              |
| `// [2, 3, 4]`                    | menu of those values          |
| `// [round:Round, square:Square]` | menu with labels              |
| none, on `true` or `false`        | checkbox                      |
| none, on a string                 | text box                      |

- `/* [Group name] */` starts a group for the settings below it.
  `/* [Hidden] */` hides the ones that follow.
- A `//` comment on its own line just above a setting is its caption.
  A comment at the end of the line before does not count.
- Put a blank line between a file's opening comment and its first setting,
  so the opening comment is not taken as that setting's caption.

## Changing settings without editing the file

```sh
kerf render box.kerf -D width=200 -D 'label="Oak"'
kerf render box.kerf --params oak.json
kerf params box.kerf
```

`-D` values are KerfScript values, so strings need their quotes. `kerf params`
prints the settings as JSON. From JavaScript, pass `params` to `render()` and
read them with `parameters()`; see [JavaScript API](javascript.md).
