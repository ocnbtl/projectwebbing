export type CursorTarget = { x: number; y: number };
type Point = CursorTarget;
type Gesture = { to: Point; pace: number; pause: number; precision: boolean };
type Journey = Gesture & {
  from: Point; a: Point; b: Point; duration: number; elapsed: number;
  acceleration: number; braking: number; deviation: number; phase: number;
};

export type AmbientCursor = {
  position: Point;
  journey: Journey | null;
  gestures: Gesture[];
  hold: number;
  pace: number;
  handedness: number;
  intent: "inspect" | "read" | "search" | "trace";
  phase: number;
  heading: number;
  speed: number;
  age: number;
  idle: number;
};

const between = (min: number, max: number, random: () => number) => min + random() * (max - min);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const inside = (point: Point): Point => ({ x: clamp(point.x, .06, .94), y: clamp(point.y, .14, .88) });

export function createAmbientCursor(index: number, random = Math.random): AmbientCursor {
  return {
    position: { x: between(.09, .91, random), y: between(.2, .82, random) },
    journey: null, gestures: [], hold: between(.05, .45, random) + index * .16,
    pace: between(.75, 1.35, random), handedness: random() < .5 ? -1 : 1,
    intent: "inspect", phase: random() * Math.PI * 2,
    heading: random() * Math.PI * 2, speed: 0, age: 0, idle: 0,
  };
}

// Plan an interaction, not a screensaver route. A fast approach leads to local
// inspection, reading, searching, or a loose drag, followed by time to think.
// These decorative gestures are independent of real visitor coordinates.
function planGestures(cursor: AmbientCursor, width: number, height: number, random: () => number, targets: readonly Point[]) {
  const add = (to: Point, pace: number, pause: number, precision = false) => {
    cursor.gestures.push({ to: inside(to), pace, pause, precision });
  };
  const offset = (point: Point, x: number, y: number) => inside({ x: point.x + x / width, y: point.y + y / height });
  const roll = random();
  cursor.intent = roll < .40 ? "inspect" : roll < .76 ? "read" : roll < .94 ? "search" : "trace";
  const local = random() < .24;
  const target=targets.length?targets[Math.floor(random()*targets.length)]:{x:between(.2,.8,random),y:between(.3,.75,random)};
  const focus = local
    ? offset(cursor.position, between(-170, 170, random), between(-100, 100, random))
    : offset(target,between(-36,36,random),between(-15,28,random));
  const dx = (focus.x - cursor.position.x) * width, dy = (focus.y - cursor.position.y) * height;
  const distance = Math.hypot(dx, dy);
  if (distance > 110 && random() < .45) {
    // Land a little wide, notice, then correct. The correction is a separate
    // gesture with its own hesitation, not a perfectly eased final endpoint.
    const overshoot = between(6, 16, random);
    add(offset(focus, dx / distance * overshoot, dy / distance * overshoot), .95, between(.07, .19, random));
    add(focus, 1.25, between(.3, .85, random), true);
  } else add(focus, between(.8, 1.1, random), between(.35, 1, random));

  let last = focus;
  if (cursor.intent === "inspect") {
    const count = Math.floor(between(1, 3, random));
    for (let i = 0; i < count; i++) {
      last = offset(last, between(-35, 38, random), between(-20, 24, random));
      add(last, between(1, 1.7, random), between(.25, .85, random), true);
    }
  } else if (cursor.intent === "read") {
    const direction = focus.x > .65 ? -1 : 1;
    for (let i = 0; i < Math.floor(between(1, 3, random)); i++) {
      last = offset(last, direction * between(22, 90, random), between(-5, 13, random));
      add(last, between(1.3, 2.2, random), between(.2, .7, random));
    }
    // Occasionally glance back at the beginning of the line.
    if (random() < .6) add(offset(focus, between(-15, 18, random), between(20, 42, random)), .9, .7);
  } else if (cursor.intent === "search") {
    const count = Math.floor(between(2, 4, random));
    for (let i = 0; i < count; i++) {
      last = offset(focus, between(-130, 130, random), between(-65, 85, random));
      add(last, between(.6, 1.25, random), between(.12, .55, random));
    }
    add(offset(last, between(-12, 12, random), between(-8, 8, random)), 1.3, .8, true);
  } else {
    // A held gesture changes direction without a stop at every waypoint.
    const direction = focus.x > .5 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      last = offset(last, direction * between(24, 65, random), between(-40, 45, random));
      add(last, between(1.1, 1.65, random), random() < .25 ? between(.1, .3, random) : 0);
    }
  }
  cursor.gestures.forEach(gesture=>{gesture.pause*=.45;});
  cursor.gestures[cursor.gestures.length - 1].pause = random()<.08?between(.65,1.1,random):between(.08,.32,random);
}

export function advanceAmbientCursor(cursor: AmbientCursor, dt: number, width: number, height: number, random = Math.random, targets: readonly CursorTarget[] = []) {
  dt = clamp(dt, 0, .064);
  cursor.age += dt;
  if (!cursor.journey) {
    cursor.idle += dt;
    cursor.speed *= Math.exp(-dt * 9);
    cursor.hold -= dt;
    if (cursor.hold > 0) return;
    if (!cursor.gestures.length) planGestures(cursor, width, height, random, targets);
    const gesture = cursor.gestures.shift()!;
    const from = { ...cursor.position }, dx = gesture.to.x - from.x, dy = gesture.to.y - from.y;
    const distance = Math.hypot(dx * width, dy * height);
    const bend = gesture.precision ? between(-.015, .015, random) : between(-.10, .14, random);
    const secondBend=bend*between(.2,1.1,random);
    cursor.journey = {
      ...gesture, from,
      a: inside({ x: from.x + dx * .22 - dy * bend * height / width, y: from.y + dy * .22 + dx * bend * width / height }),
      b: inside({ x: from.x + dx * .8 - dy * secondBend * height / width, y: from.y + dy * .8 + dx * secondBend * width / height }),
      duration: clamp((.22 + Math.log2(1+distance/28)*.13) * cursor.pace * gesture.pace, .25, 2),
      elapsed: 0, acceleration: between(1.05, 1.3, random), braking: between(1.2, 1.65, random),
      deviation: gesture.precision ? .25 : Math.min(distance * .02, between(1, 3, random)), phase: random() * Math.PI * 2,
    };
    cursor.idle = 0;
  }

  const journey = cursor.journey;
  journey.elapsed += dt;
  const progress = clamp(journey.elapsed / journey.duration, 0, 1);
  const acceleration = progress ** journey.acceleration;
  const t = acceleration / (acceleration + (1 - progress) ** journey.braking);
  const u = 1 - t;
  const dx = (journey.to.x - journey.from.x) * width, dy = (journey.to.y - journey.from.y) * height;
  const length = Math.max(1, Math.hypot(dx, dy));
  // Small, non-repeating hand deviations vanish at the intended target.
  const deviation = Math.sin(Math.PI * t) * journey.deviation *
    (Math.sin(t * 8.3 + journey.phase) * .7 + Math.sin(t * 17.1 + journey.phase * 1.7) * .3);
  const next = inside({
    x: u ** 3 * journey.from.x + 3 * u * u * t * journey.a.x + 3 * u * t * t * journey.b.x + t ** 3 * journey.to.x - dy / length * deviation / width,
    y: u ** 3 * journey.from.y + 3 * u * u * t * journey.a.y + 3 * u * t * t * journey.b.y + t ** 3 * journey.to.y + dx / length * deviation / height,
  });
  const stepX = (next.x - cursor.position.x) * width, stepY = (next.y - cursor.position.y) * height;
  const distance = Math.hypot(stepX, stepY);
  if (distance > .05) cursor.heading = Math.atan2(stepY, stepX);
  cursor.speed += (distance / Math.max(dt, .001) - cursor.speed) * (1 - Math.exp(-dt * 14));
  cursor.position = next;
  if (progress === 1) { cursor.journey = null; cursor.hold = journey.pause; }
}
