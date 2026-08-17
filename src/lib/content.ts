import "server-only";

import localContent from "@/content/madagin-content.json";
import type { ContentItem, ContentKind, ContentStatus } from "@/lib/content-types";

export type { ContentItem, ContentKind, ContentStatus } from "@/lib/content-types";

const CONTENT_REPOSITORY_PATH = "src/content/madagin-content.json";
const GITHUB_API_VERSION = "2026-03-10";

type ContentDatabase = {
  version: 1;
  items: ContentItem[];
};

type RepositoryFile = {
  database: ContentDatabase;
  sha?: string;
};

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
  sha?: string;
};

type GitHubWriteResponse = {
  commit?: {
    html_url?: string;
    sha?: string;
  };
};

export type PublishingStatus = {
  configured: boolean;
  label: "Ready" | "GitHub setup needed";
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

function repositoryCoordinates() {
  const value = process.env.GITHUB_CONTENT_REPOSITORY?.trim() ?? "";
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function repositoryBranch() {
  return process.env.GITHUB_CONTENT_BRANCH?.trim() || "main";
}

function githubHeaders() {
  const token = process.env.GITHUB_CONTENT_TOKEN?.trim();
  if (!token) throw new Error("GitHub publishing is not configured.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

function repositoryFileUrl() {
  const coordinates = repositoryCoordinates();
  if (!coordinates) throw new Error("GitHub publishing is not configured.");
  const path = CONTENT_REPOSITORY_PATH.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(coordinates.owner)}/${encodeURIComponent(coordinates.repo)}/contents/${path}`;
}

export function getPublishingStatus(): PublishingStatus {
  const configured = Boolean(
    process.env.GITHUB_CONTENT_TOKEN?.trim() && repositoryCoordinates(),
  );
  return configured
    ? {
        configured: true,
        label: "Ready",
        detail: "Saving creates a GitHub commit; Vercel publishes that commit automatically.",
      }
    : {
        configured: false,
        label: "GitHub setup needed",
        detail: "Add a fine-grained GitHub token with Contents write access to publish from here.",
      };
}

async function readRepositoryDatabase(): Promise<RepositoryFile> {
  const response = await fetch(
    `${repositoryFileUrl()}?ref=${encodeURIComponent(repositoryBranch())}`,
    {
      cache: "no-store",
      headers: githubHeaders(),
    },
  );

  if (response.status === 404) {
    return { database: parseDatabase(localContent) };
  }
  if (!response.ok) {
    throw new Error(`GitHub could not read the content file (${response.status}).`);
  }

  const file = (await response.json()) as GitHubContentResponse;
  if (file.encoding !== "base64" || !file.content || !file.sha) {
    throw new Error("GitHub returned an unreadable content file.");
  }

  const decoded = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
  return {
    database: parseDatabase(JSON.parse(decoded) as unknown),
    sha: file.sha,
  };
}

function byNewest(a: ContentItem, b: ContentItem) {
  return b.publishedOn.localeCompare(a.publishedOn) || b.updatedAt.localeCompare(a.updatedAt);
}

export async function getContentItems(options?: {
  kind?: ContentKind;
  includeDrafts?: boolean;
}) {
  const database = parseDatabase(localContent);
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
  if (!getPublishingStatus().configured) {
    throw new Error("GitHub publishing is not configured.");
  }

  const { database, sha } = await readRepositoryDatabase();
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

  const nextDatabase = JSON.stringify(
    { version: 1, items: nextItems } satisfies ContentDatabase,
    null,
    2,
  );
  const action = item.status === "published" ? "Publish" : "Save draft";
  const response = await fetch(repositoryFileUrl(), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify({
      branch: repositoryBranch(),
      content: Buffer.from(`${nextDatabase}\n`, "utf8").toString("base64"),
      message: `${action} ${item.kind}: ${item.title}`,
      ...(sha ? { sha } : {}),
    }),
  });

  if (response.status === 409) {
    throw new Error("The content file changed while you were editing. Refresh and try again.");
  }
  if (!response.ok) {
    throw new Error(`GitHub could not save the content (${response.status}).`);
  }

  const result = (await response.json()) as GitHubWriteResponse;
  return {
    item,
    commitSha: result.commit?.sha,
    commitUrl: result.commit?.html_url,
  };
}
