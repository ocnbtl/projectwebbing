# Madagin hero-film contract

The public homepage works without a video. When the cinematic film is approved, add an optimized asset here or provide an external URL through NEXT_PUBLIC_MADAGIN_HERO_VIDEO.

## Recommended delivery

- MP4 using H.264 for broad compatibility.
- Optional WebM can be added when the component is expanded to multiple sources.
- No audio track. Browsers block audible autoplay and the concept does not need sound.
- Dark opening frame with enough calm negative space for the white Plaster wordmark.
- Slow, editorial motion that survives cropping at 16:9, 4:5, and narrow mobile widths.
- No essential detail at the extreme edges.
- A short seamless or visually forgiving ending; the film remains pinned during the scroll sequence.
- Include a poster frame when the final film is delivered.

## Performance target

- Prefer a short loop or a film under roughly 8 MB after compression.
- Test the actual encoded asset on a mid-range phone and a throttled connection.
- Preserve the existing code-native fallback for reduced motion, failed loading, and future low-bandwidth handling.

## Local path example

Place a file at:

    public/media/madagin-hero.mp4

Then set:

    NEXT_PUBLIC_MADAGIN_HERO_VIDEO=/media/madagin-hero.mp4

Do not commit unapproved source footage, client assets, licensed music, or raw generation outputs.
