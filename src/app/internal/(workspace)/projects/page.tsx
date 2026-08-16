import { ContentStudio } from "@/components/internal/content-studio";
import { getContentItems, getPublishingStatus } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function InternalProjectsPage() {
  const items = await getContentItems({ kind: "project", includeDrafts: true });
  return (
    <ContentStudio
      items={items}
      kind="project"
      publishing={getPublishingStatus()}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
