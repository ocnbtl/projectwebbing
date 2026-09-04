# Island Tree 01 Candidate BW derivative provenance

- Source: [Island Tree 01](https://polyhaven.com/a/island_tree_01)
- Publisher: Poly Haven
- Authors: Rico Cilliers (cleanup and processing), Rob Tuytel (scanning and processing)
- License: [CC0 1.0 Universal](https://polyhaven.com/license)
- Retrieved: 2026-09-04
- Source API: https://api.polyhaven.com/files/island_tree_01
- Source package: the exact 1K glTF and dependencies returned by the public API
- Runtime role: a distinct, grounded, fully three-dimensional coastal broadleaf family for bounded balanced/high desktop Ridge, Valley, and Lake anchors

## Verified source package

The retrieved files matched the API-provided MD5 values before conversion:

| File | Bytes | MD5 |
| --- | ---: | --- |
| `island_tree_01_1k.gltf` | 8,576 | `fbc0c570ebd71ea88cedc1f9d5edb835` |
| `island_tree_01.bin` | 60,709,812 | `8271f2d12c2727bd647ce0c242acdcec` |
| nine referenced 1K JPG textures | 5,618,880 | individually verified against the API response during acquisition |

The full source package is deliberately not shipped or committed. Poly Haven reports the raw model at roughly four million triangles. It was held in a task-specific temporary directory solely for the reproducible conversion below.

## Selected runtime derivative

- Reproduction: `tools/blender/build_madagin_island_tree_01_bw.py`
- Blender: 5.2.0 LTS
- Method: separate the three source material authorities, preserve source transforms/materials, apply role-specific collapse decimation, smooth the retained surface normals, and export one embedded GLB
- Source triangle counts: trunk 34,787; branches 504,584; leaves 1,060,032
- Runtime triangle counts: trunk 29,999; branches 32,000; leaves 48,000; total 109,999
- Runtime file: `island_tree_01_bw.glb`
- Runtime bytes: 12,683,140
- Runtime SHA-256: `61E7AE377CCDD11C3D8BE3DE4CCCC9B628FBCC52B1D1DF28B6339F3E5662CB28`

The source is CC0, but this record preserves exact operational provenance and makes the production derivative reproducible.
