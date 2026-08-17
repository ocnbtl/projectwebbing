"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getInternalSession } from "@/lib/auth";
import {
  getContentItems,
  saveContentItem,
  type ContentItem,
  type ContentKind,
  type ContentStatus,
} from "@/lib/content";

export type ContentActionState = {
  state: "idle" | "success" | "error";
  message: string;
  itemId?: string;
};

export const initialContentActionState: ContentActionState = {
  state: "idle",
  message: "",
};

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validateSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validateDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateCoverUrl(value: string) {
  if (!value) return true;
  if (/^\/media\/[A-Za-z0-9/_ .-]+$/.test(value) && !value.includes("..")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveContentAction(
  _previousState: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const session = await getInternalSession();
  if (!session) return { state: "error", message: "Your session expired. Sign in again." };

  const kind = field(formData, "kind") as ContentKind;
  const status = field(formData, "intent") as ContentStatus;
  const title = field(formData, "title");
  const slug = field(formData, "slug");
  const summary = field(formData, "summary");
  const body = field(formData, "body");
  const details = field(formData, "details");
  const coverImageUrl = field(formData, "coverImageUrl");
  const publishedOn = field(formData, "publishedOn");
  const requestedId = field(formData, "id");

  if (kind !== "project" && kind !== "post") {
    return { state: "error", message: "Choose a valid content type." };
  }
  if (status !== "draft" && status !== "published") {
    return { state: "error", message: "Choose Save draft or Publish." };
  }
  if (!title || title.length > 120) {
    return { state: "error", message: "Add a title no longer than 120 characters." };
  }
  if (!validateSlug(slug)) {
    return { state: "error", message: "Use lowercase words and hyphens for the slug." };
  }
  if (summary.length > 320 || body.length > 20_000 || details.length > 180) {
    return { state: "error", message: "One or more fields are longer than the editor allows." };
  }
  if (!validateDate(publishedOn)) {
    return { state: "error", message: "Add a valid publication date." };
  }
  if (!validateCoverUrl(coverImageUrl)) {
    return { state: "error", message: "Use a committed /media path or a valid HTTPS image URL." };
  }
  if (status === "published" && (!summary || !body)) {
    return { state: "error", message: "Published content needs both a summary and a story." };
  }

  const items = await getContentItems({ kind, includeDrafts: true });
  const existing = requestedId ? items.find((item) => item.id === requestedId) : undefined;
  if (requestedId && !existing) {
    return { state: "error", message: "That item no longer exists. Refresh and try again." };
  }

  const now = new Date().toISOString();
  const item: ContentItem = {
    id: existing?.id ?? randomUUID(),
    kind,
    title,
    slug,
    summary,
    body,
    details,
    coverImageUrl,
    publishedOn,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  try {
    await saveContentItem(item);
  } catch (error) {
    return {
      state: "error",
      message: error instanceof Error ? error.message : "The content could not be saved.",
    };
  }

  revalidatePath("/");
  revalidatePath(kind === "project" ? "/projects" : "/blog");
  revalidatePath(`/${kind === "project" ? "projects" : "blog"}/${slug}`);
  revalidatePath(kind === "project" ? "/internal/projects" : "/internal/blog");

  return {
    state: "success",
    message:
      status === "published"
        ? "Committed. Vercel will publish the new build shortly."
        : "Draft committed to GitHub.",
    itemId: item.id,
  };
}
