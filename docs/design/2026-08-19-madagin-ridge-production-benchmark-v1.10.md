# Madagin Ridge production benchmark v1.10

This board fixes the real-world look target for the first production-intent
vertical slice. The live scene is an original synthesis; none of these images
is used as a plate, texture, or copied location.

## Three review moments

### 01 — Opening approach

- Reference: [Hono O Na Pali extension, Hawai'i DLNR](https://dlnr.hawaii.gov/ecosystems/nars/kauai/hono-o-na-pali-2/extension/)
- Read: a high camera looks across overlapping, moisture-darkened native wet
  forest. Crown heights vary, the ridge is continuous, and drainage produces
  openings instead of uniform random spacing.
- Madagin target: 46–52 mm full-frame-equivalent lens, camera 28–34 m above the
  foreground shoulder, a layered canopy occupying the lower two-thirds, and a
  clear but irregular crest against the sky.

### 02 — Crest

- Reference: [The Kalawao Coastline, U.S. National Park Service](https://www.nps.gov/media/photo/view.htm?id=60A463D9-3258-478C-B4EE-82C578E2339B)
- Read: volcanic folds are broad and geologically connected rather than a row
  of peaks. Warm side light separates shoulders while atmospheric perspective
  cools and softens the far cliffs.
- Madagin target: the camera rises slightly as it approaches a decisive crest;
  exposed basalt follows steep drainage ribs, and windward crowns flatten near
  the skyline without turning into a continuous hedge.

### 03 — First valley glimpse

- Reference: [USGS, Water Resources of the Hawaiian Islands](https://pubs.usgs.gov/sir/2016/5103/sir20165103.pdf)
- Read: the Hanalei and Wai'oli mountain photograph shows nested watersheds,
  large-scale depth, and terrain shaped by water. The valley is revealed as a
  much larger system, not as a prop immediately behind the ridge.
- Madagin target: a controlled glimpse through the crest shows one near fold,
  one misted middle fold, and a distant wall; the opening stays partial so the
  later Valley checkpoint retains its reveal.

## Supporting look-development references

- [Alakai Swamp Trail, Hawai'i DLNR](https://dlnr.hawaii.gov/dsp/hiking/kauai/alakai-swamp-trail/): wet soil, mud, fern structure, short native forest,
  and mist belong in sheltered ground pockets rather than as uniform haze.
- [The Pali Trail, NPS public-domain asset](https://npgallery.nps.gov/AssetDetail/f8076334-5193-405f-8adb-4f6fd30fc408): 24 mm reference for large cliff scale and readable foreground-to-background separation.
- [Garden Island Photography field guide](https://gardenislandphotography.com/): warm grazing light should strike the ridge from the side; shadows remain cool and detailed instead of becoming black-green.

## Fixed visual targets

| System | Target |
|---|---|
| Ridge silhouette | One authored crest with shoulders, saddle, drainage cuts, basalt ribs, and a real drop beyond it |
| Canopy density | 80–92% coverage in sheltered slopes; 55–72% near the wind-exposed crest; crown overlap without a single repeated silhouette |
| Lighting | Sun 12–18 degrees above the horizon, warm side key, cool sky fill, readable contact shadows, restrained bloom |
| Atmosphere | Mist pooled below the crest and in drainages; three depth layers remain legible; no white horizon wash |
| Camera | 46–52 mm opening, stabilized 14-second move, gentle rise at the crest, no ground-level free-flight behavior |
| Terrain material | Forest litter on shallow slopes, moss in wet pockets, wet basalt on steep ribs, macro variation without visible tiling |
| Ground contact | Ferns, shrubs, moss, roots, deadwood, stones, and occlusion explain every near-field opening |

## Approved local source assets

All reusable source assets are already vendored under
`public/world/assets/polyhaven/`, with exact source URLs, creators, licenses,
retrieval dates, hashes, and modifications recorded in each adjacent
`PROVENANCE.md`.

- `pachira_aquatica_01`: CC0 broadleaf structure for authored canopy variants.
- `fern_02`, `shrub_04`, and `moss_01`: CC0 understory and ground interaction.
- `rock_09` and `rock_moss_set_02`: CC0 volcanic outcrop and mossed-stone detail.
- `forrest_ground_03` and `aerial_grass_rock`: CC0 PBR forest-floor and rock/grass material inputs.

The v1.9 primitive tree, faceted rocks, and ring-built peaks remain historical
evidence only. They are not foreground or middle-distance sources for the v1.10
Ridge benchmark.
