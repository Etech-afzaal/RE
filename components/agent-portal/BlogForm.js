"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  IMAGE_KINDS,
  imageProcessErrorMessage,
  imageSizeErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { compressImageForUpload } from "@/lib/clientImageCompress";
import {
  BLOG_CONTENT_MAX,
  BLOG_SHORT_DESCRIPTION_MAX,
  BLOG_TITLE_MAX,
} from "@/lib/validators/blogValidator";
import ui from "@/components/agent-portal/portal.module.css";
import AgentMessagePopup from "@/components/agent-portal/AgentMessagePopup";
import styles from "./BlogForm.module.css";

const EMPTY_FORM = {
  title: "",
  short_description: "",
  content: "",
  status: "draft",
};

export default function BlogForm({ mode, blogId, initial, base, username, agentName }) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title || "",
          short_description: initial.short_description || "",
          content: initial.content || "",
          status: initial.status || "draft",
        }
      : EMPTY_FORM,
  );
  const [coverImage, setCoverImage] = useState(initial?.cover_image || null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  async function selectImage(file) {
    if (!file) return;
    setImageError("");
    setError("");

    const validated = validateImageUploadFile(file, IMAGE_KINDS.PROPERTY);
    if (!validated.ok) {
      setImageError(validated.error);
      return;
    }

    try {
      const compressed = await compressImageForUpload(file);
      const afterCompress = validateImageUploadFile(compressed, IMAGE_KINDS.PROPERTY);
      if (!afterCompress.ok) {
        setImageError(afterCompress.error);
        return;
      }
      setSelectedImage(compressed);
      setImageError("");
    } catch (err) {
      const message = String(err?.message || "").trim();
      setImageError(
        message && message !== "Error" ? message : imageProcessErrorMessage(),
      );
    }
  }

  function clearPendingImage() {
    setSelectedImage(null);
    setImageError("");
    setError("");
  }

  async function removeCoverImage() {
    if (!isEdit || !blogId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/blogs/${blogId}/image`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not remove cover image.");
      }
      setCoverImage(null);
      setSelectedImage(null);
    } catch (err) {
      setError(err.message || "Could not remove cover image.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.title.trim() || form.title.trim().length < 3) {
      setSaving(false);
      setError("Title must be at least 3 characters.");
      return;
    }
    if (
      !form.short_description.trim() ||
      form.short_description.trim().length < 10
    ) {
      setSaving(false);
      setError("Short description must be at least 10 characters.");
      return;
    }
    if (form.status === "published" && !form.content.trim()) {
      setSaving(false);
      setError("Content is required to publish a blog.");
      return;
    }
    if (form.content.length > BLOG_CONTENT_MAX) {
      setSaving(false);
      setError(`Content must be ${BLOG_CONTENT_MAX} characters or fewer.`);
      return;
    }

    try {
      let resultId = blogId;
      let resultSlug = null;

      if (isEdit) {
        const res = await fetch(`/api/blogs/${blogId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not update blog.");
        }
        resultSlug = data.blog?.slug || null;
      } else {
        const res = await fetch("/api/blogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not create blog.");
        }
        resultId = data.id;
        resultSlug = data.slug;
      }

      if (selectedImage && resultId) {
        const fd = new FormData();
        fd.append("image", selectedImage);
        const imageRes = await fetch(`/api/blogs/${resultId}/image`, {
          method: "POST",
          body: fd,
        });
        const imageData = await imageRes.json().catch(() => ({}));
        if (!imageRes.ok) {
          setImageError(imageData.error || imageSizeErrorMessage());
          throw new Error(
            imageData.error || "Blog saved but cover image upload failed.",
          );
        }
        setCoverImage(imageData.cover_image || null);
      }

      setSelectedImage(null);
      setSuccess(isEdit ? "Blog updated." : "Blog created.");
      if (!isEdit) {
        router.push(`${base}/blogs?notice=${encodeURIComponent("Blog created.")}`);
      }
    } catch (err) {
      setError(err.message || "Could not save blog.");
    } finally {
      setSaving(false);
    }
  }

  const showCoverPreview = Boolean(imagePreview || coverImage);
  const showRemoveCover = isEdit && Boolean(coverImage) && !selectedImage;

  return (
    <>
      <AgentMessagePopup
        message={success || error || imageError}
        tone={success ? "success" : "error"}
        onClose={() => {
          setSuccess("");
          setError("");
          setImageError("");
        }}
      />
      <form className={ui.formCard} onSubmit={submit}>

      <div className={styles.coverSection}>
        <div className={styles.coverPreview}>
          {showCoverPreview ? (
            <Image
              src={imagePreview || coverImage}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className={styles.coverImage}
            />
          ) : (
            <div className={styles.coverFallback}>Cover image</div>
          )}
        </div>
        <div className={styles.coverActions}>
          <label className={ui.btnGhost} style={{ cursor: "pointer" }}>
            {selectedImage ? "Image selected" : "Upload cover image"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={saving}
              onChange={(e) => {
                selectImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {selectedImage ? (
            <button
              type="button"
              className={ui.btnGhost}
              disabled={saving}
              onClick={clearPendingImage}
            >
              Cancel
            </button>
          ) : null}
          {showRemoveCover ? (
            <button
              type="button"
              className={ui.btnDanger}
              disabled={saving}
              onClick={removeCoverImage}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <p className={`${ui.propMeta} ${styles.coverHint}`}>
        JPG, PNG or WEBP. Maximum size 5 MB. Optional but recommended.
      </p>

      <label className={ui.field}>
        <span className={ui.label}>
          Title <span className={ui.requiredMark}>*</span>
        </span>
        <input
          className={ui.input}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="An eye-catching article title"
          maxLength={BLOG_TITLE_MAX}
          required
        />
      </label>

      <label className={ui.field}>
        <span className={ui.label}>
          Short Description <span className={ui.requiredMark}>*</span>
        </span>
        <textarea
          className={ui.textarea}
          value={form.short_description}
          onChange={(e) =>
            setForm({ ...form, short_description: e.target.value })
          }
          placeholder="A one or two sentence summary shown on the blog listing"
          maxLength={BLOG_SHORT_DESCRIPTION_MAX}
          rows={3}
          required
        />
      </label>

      <label className={ui.field}>
        <span className={ui.label}>Content</span>
        <textarea
          className={`${ui.textarea} ${styles.contentTextarea}`}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="Write your article here…"
          maxLength={BLOG_CONTENT_MAX}
          rows={16}
        />
      </label>

      <div className={styles.statusRow}>
        <label className={ui.field}>
          <span className={ui.label}>Status</span>
          <select
            className={`${ui.input} ${styles.statusSelect}`}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            disabled={saving}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <p className={styles.statusHint}>
          {form.status === "published"
            ? "Published blogs appear on your public website."
            : "Drafts are hidden from your public website."}
        </p>
      </div>

      <div className={ui.formActions}>
        <button
          type="button"
          className={ui.btnGhost}
          disabled={saving}
          onClick={() => router.push(`${base}/blogs`)}
        >
          Cancel
        </button>
        <button type="submit" className={ui.btnPrimary} disabled={saving}>
          {saving
            ? "Saving…"
            : isEdit
              ? "Save Changes"
              : "Create Blog"}
        </button>
      </div>
      </form>
    </>
  );
}
