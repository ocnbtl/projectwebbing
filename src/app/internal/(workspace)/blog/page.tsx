import { ContentStudio } from "@/components/internal/content-studio";
import { getContentItems, getPublishingStatus } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function InternalBlogPage() {
  const items = await getContentItems({ kind: "post", includeDrafts: true });
  return (
    <ContentStudio
      items={items}
      kind="post"
      publishing={getPublishingStatus()}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
