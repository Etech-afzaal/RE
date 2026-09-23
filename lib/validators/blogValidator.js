/**
 * Blog article validators.
 */

import {
  collectValues,
  firstError,
  normalizeWhitespace,
  validateLength,
} from "./common";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

export const BLOG_TITLE_MAX = 255;
export const BLOG_SLUG_MAX = 255;
export const BLOG_SHORT_DESCRIPTION_MAX = 500;
/** Rich HTML from the dashboard editor — match files-updates budget. */
export const BLOG_CONTENT_MAX = 100000;

/**
 * Slugify a title into a URL-safe slug.
 * Same approach as lib/propertySlug.js#slugifyTitle so blog URLs match the
 * existing public property URL style.
 */
export function slugifyBlogTitle(title) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "blog";
}

/** True when rich HTML has no visible text (e.g. empty `<p><br></p>`). */
export function isBlankBlogContent(html) {
  const text = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !text;
}

/**
 * Validate title, short description, content, and status for a blog.
 * Title and short description are required; content is required for
 * `published` blogs but may be empty for drafts so agents can save work
 * in progress. Content is rich HTML from the dashboard editor — sanitized
 * before storage.
 */
export function validateBlogInput(input = {}, { requireContent = false } = {}) {
  const fields = {
    title: validateLength(input.title, {
      required: true,
      min: 3,
      max: BLOG_TITLE_MAX,
    }),
    short_description: validateLength(input.short_description, {
      required: true,
      min: 10,
      max: BLOG_SHORT_DESCRIPTION_MAX,
      multiline: true,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  const data = collectValues(fields);

  const rawContent = String(input.content || "");
  if (isBlankBlogContent(rawContent)) {
    if (requireContent) {
      return { ok: false, error: "Content is required to publish a blog.", field: "content" };
    }
    data.content = "";
  } else {
    if (rawContent.length > BLOG_CONTENT_MAX) {
      return {
        ok: false,
        error: `Content must be ${BLOG_CONTENT_MAX} characters or fewer.`,
        field: "content",
      };
    }
    data.content = sanitizeRichHtml(rawContent);
  }

  return { ok: true, data };
}

/**
 * Validate a blog status input against the allowed set.
 */
export function validateBlogStatus(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return { ok: true, value: "draft" };
  if (!["draft", "published"].includes(normalized)) {
    return { ok: false, error: "Status must be draft or published." };
  }
  return { ok: true, value: normalized };
}

/**
 * Normalize a client-supplied slug. Empty values fall back to null so the
 * server regenerates the slug from the title.
 */
export function normalizeBlogSlugInput(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return "";
  return normalized
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, BLOG_SLUG_MAX);
}
