import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROPERTY_DB_STATUSES,
  PROPERTY_STATUS,
  PROPERTY_VISIBILITY,
  canAgentTransition,
} from "./status.js";

describe("property visibility model", () => {
  it("keeps visibility separate from actual status values", () => {
    assert.equal(PROPERTY_VISIBILITY.VISIBLE, false);
    assert.equal(PROPERTY_VISIBILITY.HIDDEN, true);
    assert.equal(PROPERTY_DB_STATUSES.has("hidden"), false);
  });

  it("preserves each actual status through hide and unhide", () => {
    for (const status of [
      PROPERTY_STATUS.PUBLISHED,
      PROPERTY_STATUS.UNDER_CONTRACT,
      PROPERTY_STATUS.SOLD,
    ]) {
      const hidden = { status, is_hidden: PROPERTY_VISIBILITY.HIDDEN };
      const visible = { ...hidden, is_hidden: PROPERTY_VISIBILITY.VISIBLE };
      assert.equal(hidden.status, status);
      assert.equal(visible.status, status);
      assert.equal(hidden.is_hidden, true);
      assert.equal(visible.is_hidden, false);
    }
  });

  it("keeps actual status transitions independent of visibility", () => {
    assert.equal(canAgentTransition(PROPERTY_STATUS.PUBLISHED, PROPERTY_STATUS.UNDER_CONTRACT), true);
    assert.equal(canAgentTransition(PROPERTY_STATUS.UNDER_CONTRACT, PROPERTY_STATUS.SOLD), true);
    assert.equal(canAgentTransition(PROPERTY_STATUS.SOLD, PROPERTY_STATUS.PUBLISHED), true);
  });
});
