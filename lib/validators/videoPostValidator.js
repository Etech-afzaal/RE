/**
 * Video post validators.
 */

import {
  collectValues,
  firstError,
  hasHtmlOrScript,
  normalizeMultiline,
  normalizeWhitespace,
  validateLength,
} from "./common";

export const VIDEO_POST_TITLE_MAX = 255;
export const VIDEO_POST_SLUG_MAX = 255;
export const VIDEO_POST_DESCRIPTION_MAX = 2000;

/**
 * Slugify a title into a URL-safe slug.
 * Same approach as lib/propertySlug.js#slugifyTitle and blogValidator.js#slugifyBlogTitle.
 */
export function slugifyVideoPostTitle(title) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "video";
}

/**
 * Validate title and description for a video post.
 * Title is required; description is optional for both draft and published
 * videos so agents can save quick clips without writing copy.
 */
export function validateVideoPostInput(input = {}, { requireVideo = false } = {}) {
  const fields = {
    title: validateLength(input.title, {
      required: true,
      min: 3,
      max: VIDEO_POST_TITLE_MAX,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  const data = collectValues(fields);

  // Description is free-form multiline text; reject HTML/script fragments to
  // match the rest of the app's input guards.
  const description = normalizeMultiline(input.description);
  if (description) {
    if (description.length > VIDEO_POST_DESCRIPTION_MAX) {
      return {
        ok: false,
        error: `Description must be ${VIDEO_POST_DESCRIPTION_MAX} characters or fewer.`,
        field: "description",
      };
    }
    if (hasHtmlOrScript(description)) {
      return { ok: false, error: "Please remove HTML or script tags from the description.", field: "description" };
    }
    data.description = description;
  } else {
    data.description = "";
  }

  if (requireVideo && !input.hasVideo) {
    return { ok: false, error: "A video file is required to publish a video post.", field: "video" };
  }

  return { ok: true, data };
}

/**
 * Validate a video post status input against the allowed set.
 */
export function validateVideoPostStatus(value) {
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
export function normalizeVideoPostSlugInput(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return "";
  return normalized
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, VIDEO_POST_SLUG_MAX);
}
