/**
 * Video post status constants.
 * Video posts are agent-authored videos shown on the agent public website.
 * Only `published` videos are visible publicly; drafts never appear on the
 * public site.
 */

export const VIDEO_POST_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
};

export const VIDEO_POST_DB_STATUSES = new Set(Object.values(VIDEO_POST_STATUS));

export const VIDEO_POST_STATUS_INPUTS = new Set([...VIDEO_POST_DB_STATUSES]);

export function isVideoPostPublic(status) {
  return status === VIDEO_POST_STATUS.PUBLISHED;
}

export function isVideoPostDraft(status) {
  return status === VIDEO_POST_STATUS.DRAFT;
}
