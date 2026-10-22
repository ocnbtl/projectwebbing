export type WakePoint = { x: number; y: number; time: number; distance: number; nx: number; ny: number };
export const WAKE_LIFETIME = 1100;
const MAX_LENGTH = 210;

// Resample spatially so a fast pointer does not draw one long laser-like chord.
// A resumed pointer starts a new wake instead of bridging a stale location.
export function sampleWake(trail: WakePoint[], x: number, y: number, now: number, maxLength=MAX_LENGTH) {
  const last = trail.at(-1);
  if (last) {
    const dx = x - last.x, dy = y - last.y, length = Math.hypot(dx, dy);
    if (length > 280 || (length > 2.2 && now - last.time > 180)) trail.length = 0;
    else if (length > 2.2) {
      const steps = Math.min(18, Math.ceil(length / 7));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        trail.push({ x: last.x + dx * t, y: last.y + dy * t, time: last.time + (now - last.time) * t,
          distance: last.distance + length * t, nx: -dy / length, ny: dx / length });
      }
    }
  }
  if (!trail.length) trail.push({ x, y, time: now, distance: 0, nx: 0, ny: 1 });
  const end = trail.at(-1)!;
  while (trail.length && (now - trail[0].time > WAKE_LIFETIME || end.distance - trail[0].distance > maxLength || trail.length > 64)) trail.shift();
}

// Only the ageing wake drifts. The actual pointer remains at its true position.
export function distortWake(point: WakePoint, now: number, phase: number) {
  const age = Math.max(0, Math.min(1, (now - point.time) / WAKE_LIFETIME));
  const s = point.distance * .035 + phase;
  const time = now * .001;
  const drift = age ** 1.6 * (Math.sin(s - time * .65) * 9 + Math.sin(s * 1.87 + time * .4) * 3);
  const eddy = Math.sin(s * .7 + time * .55) * age * 4;
  // Uneven light packets dissolve into gaps instead of a constant bright line.
  const packet = .5 + .5 * Math.sin(s * 1.3 + Math.sin(s * .47) * 1.4 - time * .6);
  return {
    x: point.x + point.nx * drift - point.ny * eddy,
    y: point.y + point.ny * drift + point.nx * eddy,
    alpha: (1 - age) ** 1.5 * (.15 + .85 * packet ** 1.5),
    width: (.7 + packet * 1.2) * (1 - age * .5),
    age,
  };
}
