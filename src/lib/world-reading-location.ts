export type ReadingDestination = "about" | "projects" | "blog";
export type ReadingLocation = { destination: ReadingDestination; slug?: string };

// Fragments keep the persistent world on the homepage. Every content link also
// retains its ordinary route for new tabs, copying links and capability fallbacks.
export function readWorldLocation(hash: string): ReadingLocation | null {
  let parts: string[];
  try { parts = decodeURIComponent(hash.slice(1)).split("/"); } catch { return null; }
  const [destination, slug] = parts;
  if (!["about", "projects", "blog"].includes(destination) || parts.length > 2) return null;
  if (slug && (destination === "about" || !/^[a-z0-9-]+$/.test(slug))) return null;
  return { destination: destination as ReadingDestination, ...(slug ? { slug } : {}) };
}

export function worldLocationHash(location: ReadingLocation | null) {
  return location ? `#${location.destination}${location.slug ? `/${location.slug}` : ""}` : "";
}
