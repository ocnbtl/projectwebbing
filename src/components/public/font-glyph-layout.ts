export type FontSpecimen = { family: string; weight: number; text: string; pairAdjustments?: readonly number[] };

function glyphMetrics(ctx: CanvasRenderingContext2D, specimen: FontSpecimen, size: number) {
 if (!specimen.pairAdjustments) { const m = ctx.measureText(specimen.text); return { left: -m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent, offsets: [] as number[] }; }
 let x = 0, left = Infinity, right = -Infinity, ascent = 0, descent = 0;
 const offsets = Array.from(specimen.text).map((letter, index) => {
  const at = x, m = ctx.measureText(letter);
  left = Math.min(left, at - m.actualBoundingBoxLeft); right = Math.max(right, at + m.actualBoundingBoxRight);
  ascent = Math.max(ascent, m.actualBoundingBoxAscent); descent = Math.max(descent, m.actualBoundingBoxDescent);
  x += m.width + (specimen.pairAdjustments![index] || 0) * size;
  return at;
 });
 return { left, right, ascent, descent, offsets };
}

// One native, untracked layout for the solid specimen and its glass silhouette.
// Ink bounds include overhanging swashes, rather than only the advance width.
export function fitGlyphs(ctx: CanvasRenderingContext2D, specimen: FontSpecimen, width = 1000, height = 360) {
 ctx.textAlign = "left";
 ctx.textBaseline = "alphabetic";
 ctx.fontKerning = "normal";
 ctx.letterSpacing = "0px";
 ctx.font = `${specimen.weight} 100px "${specimen.family}"`;
 const measured = glyphMetrics(ctx, specimen, 100);
 const size = 100 * Math.min(width * .86 / Math.max(1, measured.right - measured.left), height * .76 / Math.max(1, measured.ascent + measured.descent));
 ctx.font = `${specimen.weight} ${size}px "${specimen.family}"`;
 const ink = glyphMetrics(ctx, specimen, size);
 return { size, x: (width - ink.left - ink.right) / 2, baseline: (height + ink.ascent - ink.descent) / 2, offsets: ink.offsets };
}
