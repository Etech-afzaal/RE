/**
 * Files update validators for the single-page market update model.
 */

import {
  collectValues,
  firstError,
  normalizeWhitespace,
  validateLength,
} from "./common";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

export const FILES_UPDATE_TITLE_MAX = 255;
export const FILES_UPDATE_CONTENT_MAX = 100000;

/**
 * Validate title and content for the agent's files update page.
 * Title is required. Content is rich HTML produced by the dashboard
 * WYSIWYG editor — it is sanitized before storage.
 */
export function validateFilesUpdateInput(input = {}, { requireContent = false } = {}) {
  const fields = {
    title: validateLength(input.title, {
      required: true,
      min: 3,
      max: FILES_UPDATE_TITLE_MAX,
    }),
  };

  const error = firstError(fields);
  if (error) {
    return { ok: false, error: error.error, field: error.field };
  }

  const data = collectValues(fields);

  const rawContent = String(input.content || "");
  if (!rawContent.trim()) {
    if (requireContent) {
      return { ok: false, error: "Content is required to publish.", field: "content" };
    }
    data.content = "";
  } else {
    if (rawContent.length > FILES_UPDATE_CONTENT_MAX) {
      return {
        ok: false,
        error: `Content must be ${FILES_UPDATE_CONTENT_MAX} characters or fewer.`,
        field: "content",
      };
    }
    data.content = sanitizeRichHtml(rawContent);
  }

  return { ok: true, data };
}

/**
 * Validate a files update status input against the allowed set.
 */
export function validateFilesUpdateStatus(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return { ok: true, value: "draft" };
  if (!["draft", "published"].includes(normalized)) {
    return { ok: false, error: "Status must be draft or published." };
  }
  return { ok: true, value: normalized };
}
