// Raster counterparts of the code-authored SVG mark, for browser and iOS icons.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const source = await fs.readFile('src/app/icon.svg');
await sharp(source).resize(180, 180).png().toFile('src/app/apple-icon.png');
const png = await sharp(source).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await fs.writeFile('src/app/favicon.ico', Buffer.concat([header, png]));
