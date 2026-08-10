const root = document.documentElement;
const story = document.querySelector(".story");
const visual = document.querySelector("#story-visual");
const progressBar = document.querySelector("#story-progress-bar");
const sceneLabel = document.querySelector("#scene-label");
const chapters = Array.from(document.querySelectorAll(".story-chapter"));
const motionButton = document.querySelector("#motion-toggle");
const motionLabel = document.querySelector("#motion-label");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

const sceneNames = ["Potential", "Discovery", "Strategy", "Experience + build", "Expression", "Launch + care"];
let manualMotionChoice = null;
let updateQueued = false;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function segment(progress, start, end) {
  return clamp((progress - start) / (end - start));
}

function motionIsReduced() {
  return manualMotionChoice === null ? motionPreference.matches : manualMotionChoice;
}

function syncMotionPreference() {
  const reduced = motionIsReduced();
  root.dataset.motion = reduced ? "reduced" : "full";
  motionButton.setAttribute("aria-pressed", String(reduced));
  motionLabel.textContent = reduced ? "Motion reduced" : "Use less motion";
  queueStoryUpdate();
}

function updateStory() {
  updateQueued = false;

  if (!story || !visual) return;

  const storyBounds = story.getBoundingClientRect();
  const scrollableDistance = Math.max(story.offsetHeight - window.innerHeight, 1);
  const progress = clamp(-storyBounds.top / scrollableDistance);
  const reduced = motionIsReduced();
  const visualProgress = reduced ? 1 : progress;

  const roots = segment(visualProgress, 0.08, 0.3);
  const sprout = segment(visualProgress, 0.23, 0.53);
  const branches = segment(visualProgress, 0.43, 0.75);
  const blossom = segment(visualProgress, 0.67, 0.94);
  const blossomScale = 0.58 + blossom * 0.42;
  const seedOpacity = 1 - sprout * 0.55;

  visual.style.setProperty("--roots", roots.toFixed(3));
  visual.style.setProperty("--sprout", sprout.toFixed(3));
  visual.style.setProperty("--branches", branches.toFixed(3));
  visual.style.setProperty("--blossom", blossom.toFixed(3));
  visual.style.setProperty("--blossom-scale", blossomScale.toFixed(3));
  visual.style.setProperty("--seed-opacity", seedOpacity.toFixed(3));
  progressBar.style.transform = `scaleX(${progress.toFixed(3)})`;

  const activeIndex = Math.min(sceneNames.length - 1, Math.floor(progress * sceneNames.length));
  sceneLabel.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${sceneNames[activeIndex]}`;

  chapters.forEach((chapter, index) => {
    chapter.dataset.active = String(index === activeIndex);
  });
}

function queueStoryUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  window.requestAnimationFrame(updateStory);
}

motionButton.addEventListener("click", () => {
  manualMotionChoice = !motionIsReduced();
  syncMotionPreference();
});

motionPreference.addEventListener("change", () => {
  if (manualMotionChoice === null) syncMotionPreference();
});

window.addEventListener("scroll", queueStoryUpdate, { passive: true });
window.addEventListener("resize", queueStoryUpdate);

syncMotionPreference();
