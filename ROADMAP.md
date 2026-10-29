# Roadmap

What we are working towards, roughly in order. The aim of the first public
release is that people outside the project can write, customize, export and
physically cut a useful design without help.

## First public release

- [x] SVG and DXF output checked automatically in Inkscape
      (`npm run compat`, see [docs/compatibility.md](docs/compatibility.md))
- [x] Calibration square and kerf test models
- [x] Guides: getting started, layers, kerf, parts and sheets, settings,
      command line, JavaScript API, OpenSCAD differences, versions
- [x] Warnings for holes that kerf compensation closes, and for designs
      stacked on several sheets
- [ ] Reference set opened in LightBurn and xTool, with versions recorded
- [ ] Reference set cut and measured on real machines and materials
- [x] Public repository, tagged release and npm package
- [x] Website live at kerfscript.mylasertools.com

## Next

- Standard library: tabs and slots, hinges, dividers, hanging holes,
  enclosures, each with parameters, a picture, an example and tests
- Editor support: a TextMate grammar and a VS Code extension
- More fabrication warnings: features thinner than the kerf, tiny parts,
  overlapping cuts
- A small group of outside makers trying the reference projects on their
  machines

## Later

- SVG import for existing artwork, once the units, transforms and safety
  rules are settled
- Formatter and language server, after the language settles
- Language version 1.0 with the stability promise in
  [docs/versions.md](docs/versions.md)
