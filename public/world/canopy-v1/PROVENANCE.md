# Madagin canopy runtime package

September 6, 2026. These are derivatives of existing licensed project assets, not a new terrain source or a botanical accuracy claim.

## Sources

- `../v115/madagin-ridge-vegetation-mid-v1.15.glb`: previously released project assembly of Poly Haven Pachira and Small Tree sources. Only the ten names selected by `V115_SAFE_MID_VARIANTS` remain. Eight unused nodes and their unreachable resources are removed.
- `../assets/polyhaven/island_tree_01_bw/island_tree_01_bw.glb`: existing 109,999-triangle derivative of [Poly Haven Island Tree 01](https://polyhaven.com/a/island_tree_01), by Rico Cilliers and Rob Tuytel. Its original [provenance](../assets/polyhaven/island_tree_01_bw/PROVENANCE.md) remains authoritative for acquisition and original decimation.
- [Forest Ground 03](https://polyhaven.com/a/forrest_ground_03) and [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock): existing 1K project color maps.
- Existing Pachira Aquatica 01, Fern 02, Shrub 04, Rock 09 and Rock Moss Set 02 glTF packages are repacked with unchanged geometry and shared texture files. Their source directories under `../assets/polyhaven/` retain acquisition records. No new asset acquisition is involved.
- Source assets are [CC0](https://polyhaven.com/license). All originals remain intact. `manifest.json` records exact source/output hashes, dimensions, errors, removed nodes and tool versions.

## Reproduce and validate

From the repository root, install build tools in an ignored output directory:

```powershell
npm.cmd install --prefix output/releases/madagin-canopy-20260906/pipeline --no-audit --no-fund @gltf-transform/core@4.3.0 @gltf-transform/extensions@4.3.0 @gltf-transform/functions@4.3.0 meshoptimizer@0.25.0 sharp@0.35.4
node tools/gltf/build-canopy-runtime.mjs
```

Set `MADAGIN_ASSET_TOOLS` to use another tool directory. These are offline asset-build dependencies, not website runtime dependencies.

No triangles are simplified and no image is resized. Mid-level vertex attributes are retained exactly. The coastal tree's raw floating-point components are rounded in place, without changing the node transforms, triangle topology or winding. Maximum position error is 0.0001221 source metres per component, normal/tangent error 0.0002442, and UV error 0.00000763. Re-reading the encoded files must reproduce those prepared attributes exactly; cyclic triangle-index rotation by the mesh codec is normalized for this comparison.

Color textures use WebP quality 95. Alpha must match exactly. Data textures use quality 100 only when RGB RMSE is below 3/255 and mean normal direction error below 0.75 degrees; otherwise the original image is retained. Per-image maximum error is reported, so a low mean does not conceal isolated differences. Pure lossless WebP increased the tested JPEG payload and was rejected. There is no claim of byte-identical textures or GPU texture-memory reduction.

The public scene retains its accepted camera, placement, materials, sun and animation. Two shadow/foliage-light trials were rejected and are retained only in `output/releases/madagin-canopy-20260906/`. This package improves transfer feasibility; it does not pass milestone B or establish exceptional realism.

Images are stored by SHA-256 under `textures/` and referenced by the geometry GLBs. Identical Pachira images shared by mid vegetation and intact anchors therefore use one browser resource. A GLB's file size now excludes those images; measure complete unique network transfer, not just the containers, when assessing savings. The manifest lists every referenced image and its digest.
