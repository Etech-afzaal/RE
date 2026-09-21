/**
 * Blog status constants.
 * Blogs are agent-authored articles shown on the agent public website.
 * Only `published` blogs are visible publicly; drafts never appear on the
 * public site.
 */

export const BLOG_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
};

export const BLOG_DB_STATUSES = new Set(Object.values(BLOG_STATUS));

/** Status values accepted by the agent blog API endpoints (legacy + new). */
export const BLOG_STATUS_INPUTS = new Set([...BLOG_DB_STATUSES]);

export function isBlogPublic(status) {
  return status === BLOG_STATUS.PUBLISHED;
}

export function isBlogDraft(status) {
  return status === BLOG_STATUS.DRAFT;
}
