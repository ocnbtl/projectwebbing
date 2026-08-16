"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  initialContentActionState,
  saveContentAction,
  type ContentActionState,
} from "@/app/internal/(workspace)/content-actions";
import type { PublishingStatus } from "@/lib/content";
import type { ContentItem, ContentKind } from "@/lib/content-types";
import styles from "./content-studio.module.css";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function FormButtons({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className={styles.formActions}>
      <button disabled={!configured || pending} name="intent" type="submit" value="draft">
        {pending ? "Saving…" : "Save draft"}
      </button>
      <button className={styles.publishButton} disabled={!configured || pending} name="intent" type="submit" value="published">
        {pending ? "Publishing…" : "Publish"}
      </button>
    </div>
  );
}

function EditorForm({
  configured,
  item,
  kind,
  onSaved,
  today,
}: {
  configured: boolean;
  item: ContentItem | null;
  kind: ContentKind;
  onSaved: (state: ContentActionState) => void;
  today: string;
}) {
  const [state, action] = useActionState(saveContentAction, initialContentActionState);
  const [title, setTitle] = useState(item?.title ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(item?.slug));

  useEffect(() => {
    if (state.state !== "idle") onSaved(state);
  }, [onSaved, state]);

  const isProject = kind === "project";

  return (
    <form action={action} className={styles.editorForm}>
      <input name="id" type="hidden" value={item?.id ?? ""} />
      <input name="kind" type="hidden" value={kind} />

      <div className={styles.editorTopline}>
        <span>{item ? `Editing ${item.status}` : `New ${isProject ? "project" : "post"}`}</span>
        <span>{item ? `Updated ${new Date(item.updatedAt).toLocaleDateString("en-US")}` : "Not saved"}</span>
      </div>

      <label className={styles.titleField}>
        <span>Title</span>
        <input
          autoFocus={!item}
          maxLength={120}
          name="title"
          onChange={(event) => {
            const nextTitle = event.target.value;
            setTitle(nextTitle);
            if (!slugWasEdited) setSlug(slugify(nextTitle));
          }}
          placeholder={isProject ? "Project name" : "Post title"}
          required
          value={title}
        />
      </label>

      <div className={styles.twoColumnFields}>
        <label>
          <span>Slug</span>
          <input
            autoCapitalize="none"
            maxLength={120}
            name="slug"
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugWasEdited(true);
            }}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="project-name"
            required
            value={slug}
          />
        </label>
        <label>
          <span>Publication date</span>
          <input defaultValue={item?.publishedOn ?? today} name="publishedOn" required type="date" />
        </label>
      </div>

      <label>
        <span>{isProject ? "Project details" : "Section or reading time"}</span>
        <input
          defaultValue={item?.details ?? ""}
          maxLength={180}
          name="details"
          placeholder={isProject ? "Client / discipline / year" : "Field notes / 6 min read"}
        />
      </label>

      <label>
        <span>Summary</span>
        <textarea
          defaultValue={item?.summary ?? ""}
          maxLength={320}
          name="summary"
          placeholder="What should someone understand before opening the full story?"
          rows={4}
        />
      </label>

      <label>
        <span>Cover image URL</span>
        <input
          defaultValue={item?.coverImageUrl ?? ""}
          inputMode="url"
          name="coverImageUrl"
          placeholder="https://…"
          type="url"
        />
        <small>Optional. Use a public HTTPS image URL.</small>
      </label>

      <label>
        <span>{isProject ? "Project story" : "Post"}</span>
        <textarea
          defaultValue={item?.body ?? ""}
          maxLength={20_000}
          name="body"
          placeholder={isProject ? "Context, decisions, and what changed…" : "Write the note…"}
          rows={18}
        />
        <small>Separate paragraphs with a blank line.</small>
      </label>

      {state.message ? (
        <p className={state.state === "error" ? styles.formError : styles.formSuccess} role={state.state === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      ) : null}

      <FormButtons configured={configured} />
    </form>
  );
}

export function ContentStudio({
  items,
  kind,
  publishing,
  today,
}: {
  items: ContentItem[];
  kind: ContentKind;
  publishing: PublishingStatus;
  today: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const isProject = kind === "project";
  const title = isProject ? "Projects" : "Blog";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Public content</p>
          <h1>{title}</h1>
        </div>
        <button className={styles.newButton} onClick={() => setSelectedId(null)} type="button">
          New {isProject ? "project" : "post"}
        </button>
      </header>

      <div className={styles.storageState} data-ready={publishing.configured}>
        <span aria-hidden="true" />
        <strong>{publishing.label}</strong>
        <p>{publishing.detail}</p>
      </div>

      <div className={styles.workspace}>
        <aside className={styles.itemRail} aria-label={`${title} list`}>
          <div className={styles.railHeading}>
            <span>{items.length} {items.length === 1 ? "item" : "items"}</span>
          </div>
          {items.length ? (
            <div className={styles.itemList}>
              {items.map((item) => (
                <button
                  aria-pressed={selectedId === item.id}
                  className={selectedId === item.id ? styles.selectedItem : undefined}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <span>{item.status}</span>
                  <strong>{item.title}</strong>
                  <small>/{item.slug}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyRail}>
              <span>No {isProject ? "projects" : "posts"} yet.</span>
              <p>Start here when the first one is ready.</p>
            </div>
          )}
        </aside>

        <section className={styles.editor} aria-label={`${title} editor`}>
          <EditorForm
            configured={publishing.configured}
            item={selectedItem}
            key={selectedItem?.id ?? "new"}
            kind={kind}
            onSaved={(state) => {
              if (state.state === "success" && state.itemId) setSelectedId(state.itemId);
            }}
            today={today}
          />
        </section>
      </div>
    </div>
  );
}
