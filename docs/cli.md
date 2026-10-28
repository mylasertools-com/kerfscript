# Command line

The `kerf` command renders `.kerf` files to SVG, DXF or JSON. It needs
Node.js 20 or newer and comes with the `@mylasertools/kerfscript` npm
package.

```sh
npm install --global @mylasertools/kerfscript
kerf render box.kerf -o box.svg
```

Or without installing:

```sh
npx @mylasertools/kerfscript render box.kerf -o box.svg
```

## Commands

```sh
kerf render <file.kerf> [-o out.svg] [options]
kerf params <file.kerf>     # settings as JSON
kerf check <file.kerf>      # parts, sizes, cut length, sheets and warnings
```

## Options

| Option                | What it does                                                           |
| --------------------- | ---------------------------------------------------------------------- |
| `-o, --out <file>`    | output file, `.svg`, `.dxf` or `.json`; default `<file>.svg`           |
| `-D name=value`       | set a setting; the value is KerfScript: `40`, `"Oak"`, `true`, `[1,2]` |
| `-p, --params <file>` | JSON file of setting values                                            |
| `--font <file.ttf>`   | font for `text()`; repeat for more fonts. The name is the file name    |
| `--kerf <mm>`         | override kerf compensation for every part                              |
| `--sheet <W>x<H>`     | sheet size for packing, in mm                                          |
| `--gap <mm>`          | space between packed parts                                             |
| `--margin <mm>`       | space between the parts and the sheet edge (default: the gap)          |
| `--no-pack`           | keep parts where the program placed them                               |
| `--guides`            | include guide layer geometry                                           |
| `--split`             | write one file per sheet (`out-1.svg`, `out-2.svg`, ...)               |
| `-h, --help`          | show help                                                              |
| `-v, --version`       | show the version                                                       |

## Examples

```sh
kerf render sign.kerf -D 'name="Ada"' --font Inter-Bold.ttf -o ada.svg
kerf render box.kerf --sheet 400x300 --kerf 0.12 --split -o box.svg
kerf render box.kerf -o box.dxf
kerf check box.kerf
```

Warnings go to standard error and do not stop the render. Errors stop it with
the line and column, and a non-zero exit code.

## Fonts

KerfScript does not ship fonts and never reads system fonts, so a file
renders the same everywhere. Pass the fonts a design uses with `--font`. A
design that asks for `font = "Inter-Bold"` needs `--font Inter-Bold.ttf`; the
first font given is the default.
