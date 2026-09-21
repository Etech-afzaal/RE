"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FILES_UPDATE_CONTENT_MAX,
  FILES_UPDATE_TITLE_MAX,
} from "@/lib/validators/filesUpdateValidator";
import RichContentEditor from "@/components/agent-portal/RichContentEditor";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./FilesUpdateForm.module.css";

export default function FilesUpdateForm({ initial, base, username, agentName }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isEditing = Boolean(initial);

  async function save(status) {
    setSaving(true);
    setError("");
    setSuccess("");

    if (!title.trim() || title.trim().length < 3) {
      setSaving(false);
      setError("Title must be at least 3 characters.");
      return;
    }
    if (status === "published" && !content.trim()) {
      setSaving(false);
      setError("Content is required to publish.");
      return;
    }
    if (content.length > FILES_UPDATE_CONTENT_MAX) {
      setSaving(false);
      setError(`Content must be ${FILES_UPDATE_CONTENT_MAX} characters or fewer.`);
      return;
    }

    try {
      const res = await fetch("/api/files-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not save files update.");
      }

      if (status === "published") {
        setSuccess("Files update published. Your public page is live.");
      } else {
        setSuccess("Draft saved. Not visible on your public website yet.");
      }
    } catch (err) {
      setError(err.message || "Could not save files update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm("Delete your Files Updates page permanently? This cannot be undone.")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/files-updates", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete.");
      }
      router.push(base);
    } catch (err) {
      setError(err.message || "Could not delete.");
      setSaving(false);
    }
  }

  return (
    <form
      className={ui.formCard}
      onSubmit={(e) => {
        e.preventDefault();
        save("draft");
      }}
    >
      {error ? <p className={ui.error}>{error}</p> : null}
      {success ? <p className={ui.success}>{success}</p> : null}

      <p className={styles.hint}>
        Maintain your latest file prices, market updates, and area-wise rates.
        This is your single live market page — editing overwrites the previous content.
        {isEditing
          ? " Visitors always see the latest published version."
          : ""}
      </p>

      <label className={ui.field}>
        <span className={ui.label}>
          Page Title <span className={ui.requiredMark}>*</span>
        </span>
        <input
          className={ui.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. DHA Lahore File Prices Update"
          maxLength={FILES_UPDATE_TITLE_MAX}
          required
        />
      </label>

      <div className={styles.contentField}>
        <span className={styles.contentLabel}>Content</span>
        <RichContentEditor
          value={content}
          onChange={setContent}
          placeholder="Write your market update here. Use the toolbar to add headings, price tables, lists, and images."
        />
        <p className={ui.propMeta}>
          Tip: Use the table button to create price tables. Click inside a table cell to add or remove rows and columns.
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={ui.btnGhost}
          disabled={saving}
          onClick={() => save("draft")}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={saving}
          onClick={() => save("published")}
        >
          {saving ? "Publishing…" : "Publish"}
        </button>
        {isEditing ? (
          <button
            type="button"
            className={`${ui.btnDanger} ${styles.deleteBtn}`}
            disabled={saving}
            onClick={handleDelete}
          >
            Delete
          </button>
        ) : null}
      </div>
      {initial?.updated_at ? (
        <p className={styles.lastUpdated}>
          Last updated:{" "}
          {new Date(initial.updated_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      ) : null}
    </form>
  );
}
