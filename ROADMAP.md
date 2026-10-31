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

## 0.3.0: desktop app and installers

A preview without Apple or Microsoft signatures: Windows and macOS warn the
first time the app or `kerf` runs, and [docs/desktop.md](docs/desktop.md) and
[docs/cli.md](docs/cli.md) say how to allow it.

- [x] Desktop app for Windows, macOS and Linux, with Open in LightBurn
- [x] `kerfscript.wasm`, to run KerfScript from other languages
- [x] `kerf` binaries that need no Node.js, Linux packages, a Docker image
      and a snap, with the licences of everything built into them
- [x] Windows installers built and checked
- [ ] CI and the release workflow run on GitHub
- [ ] Linux: AppImage, `.deb` and `.rpm` installed and run on x64 and arm64,
      and a double-clicked `.kerf` file opens in the app
- [ ] macOS: the dmg installed and run on Apple silicon and Intel, and ⌘Q
      asks about unsaved changes
- [ ] Docker image and snap run
- [ ] Open in LightBurn tried on macOS and Linux
- [ ] Flathub screenshot, then the package manager submissions in
      [RELEASING.md](RELEASING.md)

## 0.4.0: assembly

- [x] `part()` places parts in 3D with `at` and `rotate`, and `render()`
      returns the assembly for apps to show
- [x] Collision warnings for placed parts, checked along their edges, with a
      limit on how many pairs are checked
- [x] Box, drawer organizer, phone stand, gears, slot desk sign, tilt maze,
      topo island, Morph, Solstice, Hadal, Xenospora, Wave Cathedral and
      Umbra placed with `at` and `rotate`
- [x] The mechanisms (Orbit, Trace, Stride, Tidal, Ascent, Expanse,
      Celestial, Flight, Bloom, Index, Vault, Fracture, Morphogen) and the
      new automata placed too, each with an Assembly section for its pose
- [x] The website's 3D views play each automaton's motion
- [ ] The website's 3D views built from `render().assembly`

## Next

- Standard library: tabs and slots, hinges, dividers, hanging holes,
  enclosures, each with parameters, a picture, an example and tests
- Editor support: a TextMate grammar and a VS Code extension
- More fabrication warnings: features thinner than the kerf, tiny parts,
  overlapping cuts
- A small group of outside makers trying the reference projects on their
  machines

## Later

- Signed Windows and macOS apps and binaries, notarized on macOS, and a
  Homebrew cask for the app
- SVG import for existing artwork, once the units, transforms and safety
  rules are settled
- Formatter and language server, after the language settles
- Language version 1.0 with the stability promise in
  [docs/versions.md](docs/versions.md)
