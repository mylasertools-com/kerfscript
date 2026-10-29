# Command line

Use the `kerf` command to export designs, change parameters and inspect
parts from your terminal. Install the package with Node.js 20 or newer:

```sh
npm install --global @mylasertools/kerfscript
kerf render box.kerf -o box.svg
```

You can also run it through `npx`:

```sh
npx @mylasertools/kerfscript render box.kerf -o box.svg
```

Save a `.kerf` file from the [models](https://kerfscript.mylasertools.com/models/)
to try these commands.

## Commands

```sh
kerf render <file.kerf> [-o out.svg] [options]
kerf params <file.kerf>
kerf check <file.kerf>
```

`render` exports SVG, DXF or JSON, using the output file's extension to
choose the format. `params` lists the editable settings as JSON. `check`
reports parts, dimensions, cut lengths, sheets and warnings.

## Options

| Option | Use |
| --- | --- |
| `-o, --out <file>` | Output path ending in `.svg`, `.dxf` or `.json`; defaults to `<file>.svg` |
| `-D name=value` | Override a parameter; repeat for multiple values |
| `-p, --params <file>` | Load parameter values from a JSON file |
| `--font <file.ttf>` | Supply a font file; repeat for multiple fonts |
| `--kerf <mm>` | Override kerf for every part |
| `--sheet <W>x<H>` | Set the sheet width and height in millimetres |
| `--gap <mm>` | Set spacing between parts |
| `--margin <mm>` | Set spacing at sheet edges; defaults to the gap |
| `--no-pack` | Keep the positions defined in the program |
| `--guides` | Include the guide layer |
| `--split` | Export one file per sheet |
| `-h, --help` | Show command help |
| `-v, --version` | Show version numbers |

`-D` accepts KerfScript values, including numbers, quoted strings, booleans
and lists. For example: `-D width=200` or `-D 'name="Ada"'`.

## Examples

```sh
kerf render name-sign.kerf -D 'name="Ada"' --font Inter-Bold.ttf -o ada.svg
kerf render box.kerf --sheet 400x300 --kerf 0.12 --split -o box.svg
kerf render box.kerf -o box.dxf
kerf check box.kerf
```

For multiple sheets, `--split` creates numbered files such as `box-1.svg`
and `box-2.svg`. Use it for DXF exports of a design with several sheets.

Warnings are written to standard error and allow rendering to continue.
An error stops the command, reports its location when available and returns
a non-zero exit code.

## Fonts

Supply font files with `--font` for designs that use text. The CLI does not
look up fonts installed on your system.

`--font Inter-Bold.ttf` makes the font available as `Inter-Bold`. A design
can request it with `font = "Inter-Bold"`. The first supplied font is the
default for text that does not name one.
