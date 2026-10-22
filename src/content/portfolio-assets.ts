const covers = "/media/projects/identity-covers-20261016";
const root = "/media/projects/refresh-20261016";

export const portfolioProjects: Record<string, {
  cover: string; coverAlt: string; services: string[]; categories: string[]; wordmark: string; displayName?: string; mobileName?: string; coverNote?: string;
}> = {
  "sage-burress": {
    cover: `${covers}/sage-about-portrait.jpg`,
    coverAlt: "Sage Burress, photographed in a black blazer, from her About page.",
    services: ["website design", "development"],
    categories: ["modeling", "personal portfolio"], wordmark: "Sage Burress",
  },
  "masonry-color-corrections": {
    cover: `${covers}/masonry-color-study.webp`,
    coverAlt: "Generated conceptual illustration of brick color matching: warm terracotta on the left and untreated pale brick on the right.",
    coverNote: "Concept image",
    services: ["website design", "development", "inquiry forms"],
    categories: ["contractor", "specialist services"], wordmark: "Masonry Color Corrections",
  },
  isitusa: {
    cover: "/media/projects/isitusa-brand-20261016/symbol-name.svg",
    coverAlt: "The complete ISITUSA logo alongside a layered botanical collage.",
    displayName: "Invasive Species In The United States of America",
    mobileName: "ISITUSA",
    services: ["naming", "brand strategy", "visual identity", "custom typography", "website design", "development", "custom systems"],
    categories: ["environment", "research platform"], wordmark: "Invasive Species In The United States of America",
  },
};

export function projectCapture(slug: string, view: "desktop" | "detail" | "mobile") {
  return slug === "isitusa" ? `/media/projects/isitusa-brand-20261016/${view}.jpg` : `${root}/${slug}-${view}.jpg`;
}
