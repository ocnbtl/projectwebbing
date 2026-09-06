# Ridge secondary canopy

This package contains authored vegetation placements on Madagin's existing public ridge. It is not a survey of Hawaiian vegetation and introduces no replacement terrain, photograph, or background film.

The exact terrain and model SHA-256 hashes are in [manifest.json](manifest.json). The model remains `../canopy-v1/vegetation-mid.glb`, using variants 14, 15, 4 and 6. These are the retained CC0 Poly Haven `tree_small_02` and `pachira_aquatica_01` derivatives. Original downloads, model transforms and texture provenance remain in [the shared package record](../canopy-v1/PROVENANCE.md). No new licensed asset was acquired.

## Reproduction

Use the repository's locked Node dependencies and the pinned offline glTF tools documented in the shared package. Python requires NumPy. From the canonical repository:

```
node tools/terrain/export-ridge-base.mjs
python tools/terrain/build-ridge-canopy.py
```

The exporter reads the accepted geometry recipe directly from Git commit `7536e49f76b352bfb3faab46d78174426455fda7`. It bakes the same decoded `RIDGE_V115_HIGH` transform and cumulative erosion function used by that renderer. The intermediate mesh is written under `output/releases/madagin-ridge-20260906/`, outside the runtime package. Geometry recipe changes require rebuilding and rechecking this package; do not silently reuse its placements over different terrain.

The placement builder screens a roughly 2 m raster for slope and strictly decreasing D8 drainage. It jitters 5 m candidate cells, keeps patch gaps and open high-accumulation channels, varies crown height and width, and rejects steep roots. Final root elevations are reconciled against the actual indexed triangles. The manifest reports the observed gap/burial bounds at eight points on a 0.15 m root footprint; this is a small trunk-contact test, not a claim that every branch, leaf, root system or neighboring crown is collision-free.

At runtime each source tree is centered on its basal vertices and normalized by its actual height. Source primitives retain their geometry and textures. Scalar materials are passed as scalars for single-primitive meshes; passing a one-element material array to a geometry with no groups would draw nothing. Leaf/trunk parts share the instance transform. A small phased bend responds continuously to the retained scene clock. These are authored wind cues, not a measured wind simulation.

The desktop renderer keeps this secondary canopy resident through the journey and reading destinations. Compact/conservative devices retain their existing ecology and do not load this placement file or an additional model. The terminal desktop ridge now retains the same cumulative eroded surface as the normal flight, replacing its older un-eroded surface so roots stay grounded. Outer terrain joins, camera, water, atmosphere, ordinary routes and inquiry behavior are retained.

## Rejected work

Two NOAA relief-transfer experiments are retained locally under `output/releases/madagin-ridge-20260906/` and the corresponding `ridge-release-20260906-trial` / `-revision-fixed` image sets. Additive relief produced rounded uplifts; a subtractive version produced hollow forms unrelated to the original watershed. The pale replacement material was also rejected. Neither terrain field, its ecology file, nor its runtime surface module belongs in this release. The retained NOAA/WorldCover foundation study and original source assets remain outside the selected package.
