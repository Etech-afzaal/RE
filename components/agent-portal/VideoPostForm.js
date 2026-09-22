"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isVideoFile,
  MAX_PROPERTY_VIDEO_BYTES,
  videoFormatErrorMessage,
  videoSizeErrorMessage,
} from "@/lib/videoUpload";
import {
  VIDEO_POST_DESCRIPTION_MAX,
  VIDEO_POST_TITLE_MAX,
} from "@/lib/validators/videoPostValidator";
import ui from "@/components/agent-portal/portal.module.css";
import AgentMessagePopup from "@/components/agent-portal/AgentMessagePopup";
import styles from "./VideoPostForm.module.css";

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "draft",
};

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoPostForm({
  mode,
  videoPostId,
  initial,
  base,
  username,
  agentName,
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [form, setForm] = useState(
    initial
      ? {
          title: initial.title || "",
          description: initial.description || "",
          status: initial.status || "draft",
        }
      : EMPTY_FORM,
  );
  const [videoUrl, setVideoUrl] = useState(initial?.video_url || null);
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnail_url || null);
  const [selectedVideoPreview, setSelectedVideoPreview] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [videoError, setVideoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitIntent, setSubmitIntent] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!selectedVideo) {
      setSelectedVideoPreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedVideo);
    setSelectedVideoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedVideo]);

  async function selectVideo(file) {
    if (!file) return;
    setVideoError("");
    setError("");

    if (!isVideoFile(file)) {
      setVideoError(videoFormatErrorMessage());
      return;
    }

    if (file.size > MAX_PROPERTY_VIDEO_BYTES) {
      setVideoError(videoSizeErrorMessage());
      return;
    }

    setSelectedVideo(file);
    setVideoError("");
  }

  function clearPendingVideo() {
    setSelectedVideo(null);
    setVideoError("");
    setError("");
  }

  async function uploadVideo(targetId) {
    if (!selectedVideo || !targetId) return null;
    setUploading(true);
    setUploadProgress("Uploading video…");
    setVideoError("");
    try {
      const fd = new FormData();
      fd.append("video", selectedVideo);
      const res = await fetch(`/api/video-posts/${targetId}/video`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Video upload failed.");
      }
      setVideoUrl(data.video_url || null);
      setThumbnailUrl(data.thumbnail_url || null);
      setSelectedVideo(null);
      setUploadProgress("");
      return data;
    } catch (err) {
      setUploadProgress("");
      setVideoError(err.message || "Video upload failed.");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function removeVideo() {
    if (!isEdit || !videoPostId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/video-posts/${videoPostId}/video`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not remove video.");
      }
      setVideoUrl(null);
      setThumbnailUrl(null);
      setSelectedVideo(null);
    } catch (err) {
      setError(err.message || "Could not remove video.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const requestedStatus = isEdit
      ? form.status
      : e.nativeEvent.submitter?.value === "publish"
        ? "published"
        : "draft";
    setSaving(true);
    setError("");
    setSuccess("");

    if (!form.title.trim() || form.title.trim().length < 3) {
      setSaving(false);
      setError("Title must be at least 3 characters.");
      return;
    }
    if (form.description.length > VIDEO_POST_DESCRIPTION_MAX) {
      setSaving(false);
      setError(`Description must be ${VIDEO_POST_DESCRIPTION_MAX} characters or fewer.`);
      return;
    }
    if (requestedStatus === "published" && !videoUrl && !selectedVideo) {
      setSaving(false);
      setError("A video file is required to publish a video post.");
      return;
    }

    try {
      let resultId = videoPostId;
      const saveStatus = !isEdit && requestedStatus === "published"
        ? "draft"
        : requestedStatus;

      if (isEdit) {
        const res = await fetch(`/api/video-posts/${videoPostId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, status: saveStatus }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not update video post.");
        }
      } else {
        const res = await fetch("/api/video-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, status: saveStatus }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not create video post.");
        }
        resultId = data.id;
      }

      if (selectedVideo && resultId) {
        await uploadVideo(resultId);
      }

      if (requestedStatus === "published" && saveStatus !== requestedStatus) {
        const publishRes = await fetch(`/api/video-posts/${resultId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        const publishData = await publishRes.json().catch(() => ({}));
        if (!publishRes.ok) {
          throw new Error(publishData.error || "Could not publish video post.");
        }
      }

      setSelectedVideo(null);
      setSuccess(isEdit ? "Video post updated." : "Video post created.");
      if (!isEdit) {
        router.push(`${base}/video-posts?notice=${encodeURIComponent("Video post created.")}`);
      }
    } catch (err) {
      setError(err.message || "Could not save video post.");
    } finally {
      setSaving(false);
    }
  }

  const showVideoPreview = Boolean(thumbnailUrl || videoUrl || selectedVideoPreview);
  const showRemoveVideo = isEdit && Boolean(videoUrl) && !selectedVideo;

  return (
    <>
      <AgentMessagePopup
        message={success || error || videoError}
        tone={success ? "success" : "error"}
        onClose={() => {
          setSuccess("");
          setError("");
          setVideoError("");
        }}
      />
      <form className={ui.formCard} onSubmit={submit}>

      <div className={styles.videoSection}>
        <div className={styles.videoPreview}>
          {showVideoPreview ? (
            thumbnailUrl ? (
              <div className={styles.videoThumbWrap}>
                <img
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  className={styles.videoThumb}
                />
                <span className={styles.playBadge} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M8 5v14l11-7L8 5Z" fill="white" />
                  </svg>
                </span>
              </div>
            ) : selectedVideoPreview || videoUrl ? (
              <video
                className={styles.videoPreviewVideo}
                src={selectedVideoPreview || videoUrl}
                controls
                muted
                preload="metadata"
                aria-label="Video preview"
              />
            ) : (
              <div className={styles.videoFallback}>
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10.5 9.5v4l3-2-3-2Z" fill="currentColor" />
                </svg>
              </div>
            )
          ) : selectedVideo ? (
            <div className={styles.videoFallback}>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 9.5v4l3-2-3-2Z" fill="currentColor" />
              </svg>
            </div>
          ) : (
            <div className={styles.videoFallback}>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 9.5v4l3-2-3-2Z" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
        <div className={styles.videoActions}>
          <label className={ui.btnGhost} style={{ cursor: "pointer" }}>
            {selectedVideo ? "Video selected" : videoUrl ? "Replace video" : "Upload video"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              hidden
              disabled={saving || uploading}
              onChange={(e) => {
                selectVideo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {selectedVideo ? (
            <button
              type="button"
              className={ui.btnGhost}
              disabled={saving || uploading}
              onClick={clearPendingVideo}
            >
              Cancel
            </button>
          ) : null}
          {showRemoveVideo ? (
            <button
              type="button"
              className={ui.btnDanger}
              disabled={saving || uploading}
              onClick={removeVideo}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {selectedVideo ? (
        <p className={`${ui.propMeta} ${styles.videoMeta}`}>
          {selectedVideo.name} ({formatBytes(selectedVideo.size)})
          {uploading ? ` — ${uploadProgress}` : ""}
        </p>
      ) : null}
      <p className={`${ui.propMeta} ${styles.videoHint}`}>
        MP4, WebM, or MOV. Maximum size 100 MB. Video is processed server-side
        (compressed to H.264 MP4 with a generated thumbnail).
      </p>

      <label className={ui.field}>
        <span className={ui.label}>
          Title <span className={ui.requiredMark}>*</span>
        </span>
        <input
          className={ui.input}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="An engaging video title"
          maxLength={VIDEO_POST_TITLE_MAX}
          required
        />
      </label>

      <label className={ui.field}>
        <span className={ui.label}>Description</span>
        <textarea
          className={ui.textarea}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional short description shown on the video listing"
          maxLength={VIDEO_POST_DESCRIPTION_MAX}
          rows={4}
        />
      </label>

      <div className={ui.formActions}>
        {isEdit ? (
          <>
            <button type="button" className={ui.btnGhost} disabled={saving || uploading} onClick={() => router.push(`${base}/video-posts`)}>
              Cancel
            </button>
            <button type="submit" className={ui.btnPrimary} disabled={saving || uploading}>
              {uploading ? "Uploading…" : saving ? "Saving…" : "Save Changes"}
            </button>
          </>
        ) : (
          <>
            <button type="submit" value="draft" className={ui.btnGhost} disabled={submitIntent === "publish" && (saving || uploading)} onClick={() => setSubmitIntent("draft")}>
              {uploading && submitIntent === "draft" ? "Uploading…" : saving && submitIntent === "draft" ? "Saving…" : "Save Draft"}
            </button>
            <button type="submit" value="publish" className={ui.btnPrimary} disabled={submitIntent === "draft" && (saving || uploading)} onClick={() => setSubmitIntent("publish")}>
              {uploading && submitIntent === "publish" ? "Uploading…" : saving && submitIntent === "publish" ? "Publishing…" : "Publish"}
            </button>
          </>
        )}
      </div>
      </form>
    </>
  );
}
