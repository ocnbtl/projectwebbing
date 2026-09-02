# Madagin Hawaiian rainforest aerial pass v0.7

## Intent

Make the opening read as a high drone flight over a dense Hawaiian rainforest before the ridge, while keeping the authored valley reveal, waterfall, mobile path, and adaptive-quality architecture intact.

## Implemented

- Raised the opening and reveal cameras and widened the field of view for a larger aerial read.
- Increased distant mountain height and valley-wall scale without turning the prototype into an open world.
- Added a CC0 Pachira Aquatica source set from Poly Haven with local checksums and provenance.
- Derived eight side-view and four top-down tropical impostors in Blender, then instanced them by device tier.
- Added four authored palm silhouettes, broadleaf breaks, alpine fir transition, ferns, moss, rock, deadwood, and ground tufts.
- Replaced the procedural crown blobs rejected during browser review with scanned-leaf canopy cards.
- Added low valley fog, waterfall spray, a distant instanced bird flock, and an always-present revealed water system.
- Removed the artificial waterfall cliff slab after the final desktop comparison exposed its rectangular silhouette.

## Runtime budgets observed locally

| View | Viewport / tier | FPS | Calls | Submitted triangles |
|---|---|---:|---:|---:|
| Valley reveal | 1440 × 1000 / high | 60 | 81 | 2,818,344 |
| Ridge approach | 390 × 844 / balanced | 60 | 73 | 1,142,908 |
| Valley reveal | 390 × 844 / balanced | 60 | 66 | 884,325 |

These figures are local World Lab samples, not production or field telemetry.

## Remaining realism gaps

- The distant valley walls still need a purpose-built tropical biome atlas and better close/far LOD blending.
- Water needs a reflection/ripple shader and a more geological erosion pass around the waterfall lip.
- The palm silhouettes are intentionally distant LODs; close-range scenes will need scanned or modeled source plants.
- Volumetric fog and sun shafts are represented with lightweight sprites for now, not true volumetric rendering.
- The opening remains an internal prototype and has not been integrated into the public site or deployed.
