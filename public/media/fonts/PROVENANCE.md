# Revision 3 asset sources

`BarlowCondensed-SemiBold.ttf` and its OFL license were downloaded as data from the Google Fonts repository:
https://github.com/google/fonts/tree/main/ofl/barlowcondensed
SHA256: 7b619d14bc2327509a9ef32b0890f709626f7ecc9ff61191c2a4314c5499d2d9

`UnifrakturMaguntia-Book.ttf` and its OFL license:
https://github.com/google/fonts/tree/main/ofl/unifrakturmaguntia
SHA256: d64afc0547059dd2e4a78da48bda0aba0a9901be58c7f8c201a8b2b6b4492cc8

Both font files are self-hosted through next/font/local. The browser makes no font-provider requests. No new package or install command was used.

The rounded hero meshes in ../liquid/barlow-letters.bin and barlow-letters.json are generated offline by tools/build-barlow-letters.mjs from the Barlow outline, using the existing Three.js and Sharp dependencies. The previous letters.bin/letters.json assets remain untouched.

../preview-portraits.png is a generated image of three fictional people, created for the local testimonial-layout demonstration on 2026-09-28. The quotes and identities are explicitly sample content, not actual client endorsements. The homepage renders sample proof only in development or Vercel preview; production requires verified replacement content.
