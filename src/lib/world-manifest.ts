export type WorldViewId = "journey" | "about" | "projects" | "contact";

export type JourneyCheckpointId =
  | "ridge"
  | "reveal"
  | "lake"
  | "clearing"
  | "waterfall"
  | "summit";

export type WorldVector = readonly [number, number, number];

export type JourneyCheckpoint = {
  id: JourneyCheckpointId;
  label: string;
  role: string;
  story: string;
  progress: number;
  camera: WorldVector;
  lookAt: WorldVector;
  mobileCamera: WorldVector;
  mobileLookAt: WorldVector;
  oceanLookAt: WorldVector;
  mobileOceanLookAt: WorldVector;
  skyLookAt: WorldVector;
  mobileSkyLookAt: WorldVector;
};

export type WorldView = {
  id: WorldViewId;
  label: string;
  role: string;
  behavior: string;
  entry: string;
};

export const WORLD_VIEWS: readonly WorldView[] = [
  {
    id: "journey",
    label: "Journey",
    role: "Home + values",
    behavior: "Return to the saved mountain checkpoint",
    entry: "Face forward and continue through the mountains.",
  },
  {
    id: "about",
    label: "Ocean pan",
    role: "About",
    behavior: "Rise above nearby canopy and turn west from the current checkpoint",
    entry: "Lift into a clear ocean sightline while preserving the story position.",
  },
  {
    id: "projects",
    label: "Sky tilt",
    role: "Selected projects",
    behavior: "Tilt upward from the current checkpoint; do not translate",
    entry: "Look above the mountain line while the atmosphere stays alive.",
  },
  {
    id: "contact",
    label: "Mountain ascent",
    role: "Let’s Talk",
    behavior: "Accelerate from the saved checkpoint to the contact trailhead",
    entry: "Cross the valley, settle at the base, then climb one answer at a time.",
  },
] as const;

// Coordinates are the glTF runtime coordinates after Blender's Z-up to Y-up export.
export const JOURNEY_CHECKPOINTS: readonly JourneyCheckpoint[] = [
  {
    id: "ridge",
    label: "Ridge approach",
    role: "Opening",
    story: "Move toward the weathered ridgeline before the world opens.",
    progress: 0,
    camera: [112, 82, 280],
    lookAt: [10, 48, 128],
    mobileCamera: [110, 90, 260],
    mobileLookAt: [4, 52, 116],
    oceanLookAt: [-620, 4, 18],
    mobileOceanLookAt: [-560, 8, 24],
    skyLookAt: [80, 190, 20],
    mobileSkyLookAt: [74, 185, 28],
  },
  {
    id: "reveal",
    label: "Valley reveal",
    role: "Distinctive",
    story: "Crest the ridge and let the mountain corridor unfold.",
    progress: 0.33,
    camera: [88, 166, -126],
    lookAt: [18, -43, -710],
    mobileCamera: [50, 180, -120],
    mobileLookAt: [-8, -35, -690],
    oceanLookAt: [-680, 2, -140],
    mobileOceanLookAt: [-600, 6, -130],
    skyLookAt: [20, 250, -220],
    mobileSkyLookAt: [12, 245, -210],
  },
  {
    id: "lake",
    label: "Alpine lake",
    role: "Resonant",
    story: "Settle at the irregular basin where weather, stone, and reflected light meet.",
    progress: 0.5,
    camera: [320, 190, -540],
    lookAt: [52, -42, -914],
    mobileCamera: [288, 204, -522],
    mobileLookAt: [46, -38, -904],
    oceanLookAt: [-720, -4, -700],
    mobileOceanLookAt: [-640, 2, -680],
    skyLookAt: [66, 220, -790],
    mobileSkyLookAt: [54, 218, -770],
  },
  {
    id: "clearing",
    label: "Lush clearing",
    role: "Human",
    story: "Pause where filtered sun reaches fern, moss, fallen wood, and the river-edge understory.",
    progress: 0.64,
    camera: [350, 48, -600],
    lookAt: [315, 42, -660],
    mobileCamera: [360, 54, -590],
    mobileLookAt: [312, 44, -656],
    oceanLookAt: [-720, -4, -540],
    mobileOceanLookAt: [-640, 2, -530],
    skyLookAt: [120, 180, -600],
    mobileSkyLookAt: [110, 185, -590],
  },
  {
    id: "waterfall",
    label: "Waterfall passage",
    role: "Trusted",
    story: "Follow the mountain river through broken water, wet basalt, and localized spray.",
    progress: 0.75,
    camera: [-360, 170, -380],
    lookAt: [160, -20, -730],
    mobileCamera: [-390, 188, -350],
    mobileLookAt: [160, -18, -730],
    oceanLookAt: [-740, -4, -590],
    mobileOceanLookAt: [-650, 3, -580],
    skyLookAt: [170, 215, -650],
    mobileSkyLookAt: [160, 220, -640],
  },
  {
    id: "summit",
    label: "Summit horizon",
    role: "Compelling",
    story: "Rise above the clouds and hold on an open horizon.",
    progress: 1,
    camera: [128, 214, -310],
    lookAt: [600, 90, -950],
    mobileCamera: [68, 226, -292],
    mobileLookAt: [420, 135, -1020],
    oceanLookAt: [-780, 0, -340],
    mobileOceanLookAt: [-690, 6, -330],
    skyLookAt: [80, 310, -520],
    mobileSkyLookAt: [60, 305, -500],
  },
] as const;

export const CONTACT_ASCENT = [
  { id: "status", label: "Where you are now", altitude: 0, place: "Trailhead" },
  { id: "needs", label: "What needs to change", altitude: 0.17, place: "Forest path" },
  { id: "budget", label: "Investment range", altitude: 0.34, place: "River shelf" },
  { id: "timing", label: "Timing", altitude: 0.51, place: "Alpine meadow" },
  { id: "context", label: "The wider picture", altitude: 0.68, place: "High ridge" },
  { id: "reply", label: "Where to reply", altitude: 0.84, place: "Summit approach" },
  { id: "review", label: "Review + send", altitude: 1, place: "Summit" },
] as const;

export const CONTACT_CAMERA = {
  camera: [390, 120, -520] as WorldVector,
  lookAt: [288, 50, -690] as WorldVector,
  summitCamera: [128, 214, -310] as WorldVector,
  summitLookAt: [600, 90, -950] as WorldVector,
  mobileCamera: [360, 54, -590] as WorldVector,
  mobileLookAt: [312, 44, -656] as WorldVector,
  mobileSummitCamera: [68, 226, -292] as WorldVector,
  mobileSummitLookAt: [420, 135, -1020] as WorldVector,
};

export function getWorldView(id: WorldViewId) {
  return WORLD_VIEWS.find((view) => view.id === id) ?? WORLD_VIEWS[0];
}

export function getJourneyCheckpoint(index: number) {
  return JOURNEY_CHECKPOINTS[index] ?? JOURNEY_CHECKPOINTS[0];
}
