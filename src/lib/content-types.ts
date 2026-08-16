export type ContentKind = "project" | "post";
export type ContentStatus = "draft" | "published";

export type ContentItem = {
  id: string;
  kind: ContentKind;
  title: string;
  slug: string;
  summary: string;
  body: string;
  details: string;
  coverImageUrl: string;
  publishedOn: string;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
