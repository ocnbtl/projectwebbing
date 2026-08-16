import "server-only";

import { get, put } from "@vercel/blob";
import type { ContentItem, ContentKind, ContentStatus } from "@/lib/content-types";

export type { ContentItem, ContentKind, ContentStatus } from "@/lib/content-types";

const CONTENT_PATHNAME = "madagin/content.json";

type ContentDatabase = {
  version: 1;
  items: ContentItem[];
};

type DatabaseRead = {
  database: ContentDatabase;
  etag: string | null;
};

export type PublishingStatus = {
  configured: boolean;
  label: "Ready" | "Storage needed";
  detail: string;
};

const emptyDatabase = (): ContentDatabase => ({ version: 1, items: [] });

function isContentKind(value: unknown): value is ContentKind {
  return value === "project" || value === "post";
}

function isContentStatus(value: unknown): value is ContentStatus {
  return value === "draft" || value === "published";
}

function isContentItem(value: unknown): value is ContentItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    isContentKind(item.kind) &&
    typeof item.title === "string" &&
    typeof item.slug === "string" &&
    typeof item.summary === "string" &&
    typeof item.body === "string" &&
    typeof item.details === "string" &&
    typeof item.coverImageUrl === "string" &&
    typeof item.publishedOn === "string" &&
    isContentStatus(item.status) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function parseDatabase(value: unknown): ContentDatabase {
  if (!value || typeof value !== "object") return emptyDatabase();
  const candidate = value as { version?: unknown; items?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.items)) {
    return emptyDatabase();
  }
  return {
    version: 1,
    items: candidate.items.filter(isContentItem),
  };
}

export function getPublishingStatus(): PublishingStatus {
  const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return configured
    ? {
        configured: true,
        label: "Ready",
        detail: "Drafts and published work are stored in the private Madagin content store.",
      }
    : {
        configured: false,
        label: "Storage needed",
        detail: "Connect a private Vercel Blob store to save and publish content.",
      };
}

async function readDatabase(): Promise<DatabaseRead> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { database: emptyDatabase(), etag: null };
  }

  const result = await get(CONTENT_PATHNAME, {
    access: "private",
    useCache: false,
  });

  if (!result || result.statusCode !== 200) {
    return { database: emptyDatabase(), etag: null };
  }

  const payload = await new Response(result.stream).json();
  return {
    database: parseDatabase(payload),
    etag: result.blob.etag,
  };
}

function byNewest(a: ContentItem, b: ContentItem) {
  return b.publishedOn.localeCompare(a.publishedOn) || b.updatedAt.localeCompare(a.updatedAt);
}

export async function getContentItems(options?: {
  kind?: ContentKind;
  includeDrafts?: boolean;
}) {
  const { database } = await readDatabase();
  return database.items
    .filter((item) => !options?.kind || item.kind === options.kind)
    .filter((item) => options?.includeDrafts || item.status === "published")
    .sort(byNewest);
}

export async function getPublishedContentItem(kind: ContentKind, slug: string) {
  const items = await getContentItems({ kind });
  return items.find((item) => item.slug === slug) ?? null;
}

export async function saveContentItem(item: ContentItem) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Publishing storage is not configured.");
  }

  const { database, etag } = await readDatabase();
  const duplicate = database.items.find(
    (candidate) =>
      candidate.kind === item.kind &&
      candidate.slug === item.slug &&
      candidate.id !== item.id,
  );
  if (duplicate) throw new Error("That slug is already in use.");

  const existingIndex = database.items.findIndex((candidate) => candidate.id === item.id);
  const nextItems = [...database.items];
  if (existingIndex === -1) nextItems.push(item);
  else nextItems[existingIndex] = item;

  await put(
    CONTENT_PATHNAME,
    JSON.stringify({ version: 1, items: nextItems } satisfies ContentDatabase),
    {
      access: "private",
      allowOverwrite: Boolean(etag),
      ...(etag ? { ifMatch: etag } : {}),
      cacheControlMaxAge: 60,
      contentType: "application/json; charset=utf-8",
    },
  );

  return item;
}
