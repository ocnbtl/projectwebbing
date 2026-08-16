import { PublicHome } from "@/components/public/public-home";
import { getContentItems } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [projects, posts] = await Promise.all([
    getContentItems({ kind: "project" }),
    getContentItems({ kind: "post" }),
  ]);
  return <PublicHome posts={posts} projects={projects} />;
}
