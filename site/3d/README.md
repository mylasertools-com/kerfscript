# Assembled models

The 3D models on the website (`public/3d/<slug>.glb`, shown with
`<model-viewer>` on each model page) and the assembled pictures on the model
cards (`public/3d/<slug>.webp`) are built in Blender from the examples:

```sh
cd site
node 3d/export.mjs [slug ...]          # parts of each model as JSON, in 3d/.build/
"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b -P 3d/build.py -- slug [slug ...]
```

- `export.mjs` renders a model with its parts left where the program draws
  them and no kerf, and writes their cut outlines, engraving and score lines.
- `assemblies.py` says where each part goes. Parts are drawn in x/y and are
  their thickness deep in z; a recipe returns the matrix that puts a part in
  place. Models without a recipe are laid out flat.
- `build.py` extrudes the parts, adds engraving and score lines, assembles
  them, exports the GLB and renders the picture with Cycles. `SAMPLES=32` for
  quick drafts; `NOGLB=1` or `NORENDER=1` skips one output.

A model whose code changes needs both steps again. If its parts move (new
positions, sizes that the recipe uses), update its recipe too.

`textures/wood.jpg` is the Poly Haven "plywood" texture (CC0), resized and
tinted.
