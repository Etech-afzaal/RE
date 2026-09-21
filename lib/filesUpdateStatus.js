/**
 * Files update status constants.
 * Files updates are agent-authored market/file price update pages shown on
 * the agent public website. Only `published` updates are visible publicly.
 */

export const FILES_UPDATE_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
};

export const FILES_UPDATE_DB_STATUSES = new Set(Object.values(FILES_UPDATE_STATUS));

export const FILES_UPDATE_STATUS_INPUTS = new Set([...FILES_UPDATE_DB_STATUSES]);

export function isFilesUpdatePublic(status) {
  return status === FILES_UPDATE_STATUS.PUBLISHED;
}

export function isFilesUpdateDraft(status) {
  return status === FILES_UPDATE_STATUS.DRAFT;
}
