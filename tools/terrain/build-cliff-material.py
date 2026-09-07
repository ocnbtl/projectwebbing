"""Reproducible runtime derivatives; original CC0 source remains in world-source."""
from pathlib import Path
from PIL import Image
import hashlib, json

root = Path(__file__).resolve().parents[2]
source = root / 'world-source/materials/polyhaven-aerial-rocks-04'
out = root / 'public/world/cliff-material-v1'
out.mkdir(parents=True, exist_ok=True)
files = []
for channel, name, quality in [('diff', 'color', 84), ('nor_gl', 'normal', 90), ('arm', 'response', 82)]:
    original = source / f'aerial_rocks_04_{channel}_2k.jpg'
    target = out / f'{name}.webp'
    image = Image.open(original).convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS)
    image.save(target, quality=quality, method=6)
    files.append(dict(source=original.relative_to(root).as_posix(), sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(), file=target.name, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), bytes=target.stat().st_size, dimensions=image.size, webpQuality=quality))
    target = out / f'{name}-compact.webp'
    compact = Image.open(original).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
    compact.save(target, quality=quality, method=6)
    files.append(dict(source=original.relative_to(root).as_posix(), sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(), file=target.name, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), bytes=target.stat().st_size, dimensions=compact.size, webpQuality=quality))
original = root/'public/world/canopy-v1/forest-color.webp'
target = out/'ground-compact.webp'
Image.open(original).convert('RGB').resize((512, 512), Image.Resampling.LANCZOS).save(target, quality=84, method=6)
files.append(dict(source=original.relative_to(root).as_posix(), sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(), file=target.name, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), bytes=target.stat().st_size, dimensions=[512,512], webpQuality=84))
(out/'provenance.json').write_text(json.dumps(dict(source='https://polyhaven.com/a/aerial_rocks_04', creator='Rob Tuytel', license='CC0-1.0', licenseUrl='https://polyhaven.com/license', sourceScaleMeters=80, retrieved='2026-09-07', compactGroundSource='Retained CC0 Poly Haven forrest_ground_03; see public/world/canopy-v1/PROVENANCE.md', interpretation='Photo-based rock material, not a Hawaii geological survey. No source geometry or inferred elevation is introduced. Authored slope cover and wetness are separate from the scan.', processing='Pillow RGB conversion, 1024px desktop / 512px compact LANCZOS resampling and WebP encoding. No offline color grading or invented normal detail. Runtime normals are decoded and normalized. Original download MD5 verified against official Poly Haven API.', files=files), indent=2)+'\n')
print(json.dumps(files, indent=2))
