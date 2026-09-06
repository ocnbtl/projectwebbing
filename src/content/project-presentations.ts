import "server-only";

// Curated website evidence is separate from the editable story text. Screenshots
// retain the client website context; provenance is adjacent to the media files.
type ProjectPresentation = {
  website: string;
  domain: string;
  detailTitle: string;
  detailCaption: string;
  detailAlt: string;
  mobileTitle: string;
  mobileCopy: string;
  next: { slug: string; title: string };
};

const presentations: Record<string, ProjectPresentation> = {
  "sage-burress": {
    website: "https://sageburress.com",
    domain: "sageburress.com",
    detailTitle: "Room for the work.",
    detailCaption: "The portfolio brings Sage’s photographic work into one view.",
    detailAlt: "Sage Burress’s portfolio website with an editorial grid of photographs.",
    mobileTitle: "A personal introduction, wherever it starts.",
    mobileCopy: "The mobile opening keeps Sage’s name and photography together. The menu gives visitors access to her portfolio and services, with contact close at hand.",
    next: { slug: "masonry-color-corrections", title: "Masonry Color Corrections" },
  },
  "masonry-color-corrections": {
    website: "https://masonrycolorcorrections.com",
    domain: "masonrycolorcorrections.com",
    detailTitle: "Show the match.",
    detailCaption: "The project gallery pairs the masonry problem with the finished correction.",
    detailAlt: "Masonry Color Corrections’ gallery website showing a masonry project and its before-and-after comparison.",
    mobileTitle: "From understanding the service to starting a project.",
    mobileCopy: "The opening explains the masonry problem in plain language. A visible estimate link gives visitors a next step, while the examples let the work make the case.",
    next: { slug: "sage-burress", title: "Sage Burress" },
  },
};

export function getProjectPresentation(slug: string) {
  return presentations[slug] ?? null;
}
