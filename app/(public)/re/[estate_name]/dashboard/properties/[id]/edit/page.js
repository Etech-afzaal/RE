"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import PriceCurrencyInput from "@/components/agent-portal/PriceCurrencyInput";
import ImageCategorySelect from "@/components/ImageCategorySelect";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import PropertyWatermark from "@/components/PropertyWatermark";
import VideoPreviewModal from "@/components/VideoPreviewModal";
import { companyNameFromAgent } from "@/lib/agentBranding";
import {
  MAX_PROPERTY_IMAGES,
  IMAGE_KINDS,
  imageLimitErrorMessage,
  imageProcessErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { compressImageForUpload } from "@/lib/clientImageCompress";
import {
  MAX_PROPERTY_VIDEOS,
  MAX_PROPERTY_VIDEO_BYTES,
  isVideoFile,
  videoFormatErrorMessage,
  videoLimitErrorMessage,
  videoSizeErrorMessage,
} from "@/lib/videoUpload";
import {
  DEFAULT_PRICE_CURRENCY,
  validatePropertyDraftInput,
} from "@/lib/validators/propertyValidator";
import ui from "@/components/agent-portal/portal.module.css";

function normalizePropertyVideos(property) {
  const list = Array.isArray(property?.videos) ? property.videos : [];
  if (list.length > 0) return list;
  if (property?.video_url && String(property.video_url).trim()) {
    return [{ id: null, video_url: property.video_url }];
  }
  return [];
}

function videoTitle(video, index) {
  if (video?.category_label && video.category_label !== "Uncategorized") {
    return video.category_label;
  }
  if (video?.category) return String(video.category);
  return `Video ${index + 1}`;
}

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const propertyId = params.id;
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  const [form, setForm] = useState({
    title: "",
    description: "",
    size_value: "",
    size_unit: "marla",
    price: "",
    price_currency: DEFAULT_PRICE_CURRENCY,
    city: "",
    area: "",
    phase: "",
    address: "",
    status: "draft",
  });
  const [rejection, setRejection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [deletedImageIds, setDeletedImageIds] = useState([]);
  const [newImages, setNewImages] = useState([]);
  // "existing:<id>" or "new:<key>" — exactly one image is the featured one.
  const [featuredKey, setFeaturedKey] = useState(null);
  const newImageKey = useRef(0);
  const newFileInputRef = useRef(null);
  const newVideoKey = useRef(0);
  const newVideoInputRef = useRef(null);
  const [existingVideos, setExistingVideos] = useState([]);
  const [newVideos, setNewVideos] = useState([]);
  // "existing:<id|legacy>" or "new:<key>" — featured walkthrough video.
  const [featuredVideoKey, setFeaturedVideoKey] = useState(null);
  const [deletingVideoKey, setDeletingVideoKey] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoPreviewIndex, setVideoPreviewIndex] = useState(0);
  const [watermarkText, setWatermarkText] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    (async () => {
      const [propertyRes, brandingRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}`),
        fetch("/api/agent/company-branding"),
      ]);
      const data = await propertyRes.json().catch(() => ({}));
      if (!propertyRes.ok) {
        setError(data.error || "Property not found.");
        setLoading(false);
        return;
      }
      const brandingData = await brandingRes.json().catch(() => ({}));
      setWatermarkText(
        companyNameFromAgent(brandingData.branding || session?.user),
      );
      const p = data.property;
      const hasStructured = Boolean(p.city || p.area || p.phase || p.address);
      let city = p.city || "";
      let area = p.area || "";
      let phase = p.phase || "";
      let address = p.address || "";
      // Legacy rows only have a combined location string — seed city/area so
      // agents can edit without losing the existing value.
      if (!hasStructured && p.location) {
        const parts = String(p.location)
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length >= 2) {
          city = parts[parts.length - 1];
          area = parts.slice(0, -1).join(", ");
        } else {
          area = parts[0] || "";
        }
      }
      setForm({
        title: p.title || "",
        description: p.description || "",
        size_value: p.size_value || "",
        size_unit: p.size_unit || "marla",
        price: p.price || "",
        price_currency: p.price_currency || DEFAULT_PRICE_CURRENCY,
        city,
        area,
        phase,
        address,
        status: p.status || "draft",
      });
      setRejection(
        p.status === "rejected"
          ? { reason: p.rejected_reason, at: p.rejected_at }
          : null,
      );
      const loadedImages = p.images || [];
      setExistingImages(loadedImages);
      const featured =
        loadedImages.find((image) => image.is_featured) || loadedImages[0];
      setFeaturedKey(featured ? `existing:${featured.id}` : null);
      const loadedVideos = normalizePropertyVideos(p);
      setExistingVideos(loadedVideos);
      const featuredVideo =
        loadedVideos.find((video) => video.is_featured) || loadedVideos[0];
      setFeaturedVideoKey(
        featuredVideo
          ? `existing:${featuredVideo.id ?? "legacy"}`
          : null,
      );
      setNewVideos([]);
      setLoading(false);
    })();
  }, [status, propertyId, router, session?.user]);

  useEffect(() => {
    return () => {
      newImages.forEach((item) => URL.revokeObjectURL(item.url));
      newVideos.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // Previews are revoked when leaving the page, not on every list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const currentTotal = existingImages.length + newImages.length;
    const remaining = Math.max(0, MAX_PROPERTY_IMAGES - currentTotal);
    if (remaining === 0 || incoming.length > remaining) {
      setError(imageLimitErrorMessage());
    } else {
      setError("");
    }
    if (remaining === 0) return;

    const valid = [];
    for (const file of incoming.slice(0, remaining)) {
      const validated = validateImageUploadFile(file, IMAGE_KINDS.PROPERTY);
      if (!validated.ok) {
        setError(validated.error);
        continue;
      }

      try {
        const compressed = await compressImageForUpload(file);
        valid.push(compressed);
      } catch {
        setError(imageProcessErrorMessage());
      }
    }
    if (valid.length === 0) return;

    let firstAddedKey = null;
    setNewImages((prev) => {
      const room = Math.max(
        0,
        MAX_PROPERTY_IMAGES - existingImages.length - prev.length,
      );
      const accepted = valid.slice(0, room).map((file) => {
        const key = `n${newImageKey.current++}`;
        if (!firstAddedKey) firstAddedKey = key;
        return {
          key,
          file,
          url: URL.createObjectURL(file),
          category: "",
        };
      });
      if (accepted.length === 0) return prev;
      return [...prev, ...accepted];
    });
    if (firstAddedKey) {
      setFeaturedKey((prev) => prev ?? `new:${firstAddedKey}`);
    }
  }

  function updateExistingImage(id, changes) {
    setExistingImages((prev) =>
      prev.map((image) => (image.id === id ? { ...image, ...changes } : image)),
    );
  }

  function moveExistingImage(index, offset) {
    setExistingImages((prev) => {
      const target = index + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeExistingImage(id) {
    setDeletedImageIds((prev) => [...prev, id]);
    setExistingImages((prev) => prev.filter((image) => image.id !== id));
    setFeaturedKey((prev) => (prev === `existing:${id}` ? null : prev));
  }

  function removeNewImage(key) {
    setNewImages((prev) => {
      const target = prev.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.key !== key);
    });
    setFeaturedKey((prev) => (prev === `new:${key}` ? null : prev));
  }

  function clearAllNewImages() {
    if (newImages.length === 0) return;
    const confirmed = window.confirm(
      "Remove all newly selected images?\n\nThis will remove images you just added that are not saved yet.",
    );
    if (!confirmed) return;
    setNewImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setFeaturedKey((prev) =>
      prev && String(prev).startsWith("new:") ? null : prev,
    );
    if (newFileInputRef.current) newFileInputRef.current.value = "";
  }

  function addVideos(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const currentTotal = existingVideos.length + newVideos.length;
    const remaining = Math.max(0, MAX_PROPERTY_VIDEOS - currentTotal);
    if (remaining === 0 || incoming.length > remaining) {
      setError(videoLimitErrorMessage());
    } else {
      setError("");
    }
    if (remaining === 0) return;

    const valid = [];
    for (const file of incoming.slice(0, remaining)) {
      if (!isVideoFile(file)) {
        setError(videoFormatErrorMessage());
        continue;
      }
      if (Number(file.size) > MAX_PROPERTY_VIDEO_BYTES) {
        setError(videoSizeErrorMessage());
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    const added = valid.map((file) => ({
      key: `v${newVideoKey.current++}`,
      file,
      url: URL.createObjectURL(file),
      category: "",
    }));
    setNewVideos((prev) => [...prev, ...added]);
    setFeaturedVideoKey((prev) => prev ?? `new:${added[0].key}`);
  }

  function removeNewVideo(key) {
    const confirmed = window.confirm(
      "Delete this video?\n\nThis action cannot be undone.",
    );
    if (!confirmed) return;
    setNewVideos((prev) => {
      const target = prev.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.key !== key);
    });
    setFeaturedVideoKey((prev) => {
      if (prev !== `new:${key}`) return prev;
      const remainingNew = newVideos.filter((item) => item.key !== key);
      if (remainingNew[0]) return `new:${remainingNew[0].key}`;
      if (existingVideos[0]) {
        return `existing:${existingVideos[0].id ?? "legacy"}`;
      }
      return null;
    });
    setError("");
  }

  async function removeExistingVideo(video, index) {
    const confirmed = window.confirm(
      "Delete this video?\n\nThis action cannot be undone.",
    );
    if (!confirmed) return;

    const rowKey = `existing:${video.id ?? "legacy"}`;
    setDeletingVideoKey(rowKey);
    setError("");

    try {
      let res;
      if (video.id != null) {
        res = await fetch(`/api/properties/${propertyId}/videos`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoIds: [video.id] }),
        });
      } else {
        // Legacy single video_url row without a gallery id.
        res = await fetch(`/api/properties/${propertyId}/video`, {
          method: "DELETE",
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove property video.");
        return;
      }

      setExistingVideos((prev) => {
        if (video.id != null) {
          return prev.filter((item) => item.id !== video.id);
        }
        return prev.filter((_, i) => i !== index);
      });
      setFeaturedVideoKey((prevKey) => {
        if (prevKey !== rowKey) return prevKey;
        const remaining = existingVideos.filter((item, i) =>
          video.id != null ? item.id !== video.id : i !== index,
        );
        if (remaining[0]) {
          return `existing:${remaining[0].id ?? "legacy"}`;
        }
        if (newVideos[0]) return `new:${newVideos[0].key}`;
        return null;
      });
    } catch {
      setError("Could not remove property video.");
    } finally {
      setDeletingVideoKey(null);
    }
  }

  async function refreshVideosFromServer() {
    const refreshed = await fetch(`/api/properties/${propertyId}`);
    const refreshedData = await refreshed.json().catch(() => ({}));
    if (!refreshed.ok) return;
    const loadedVideos = normalizePropertyVideos(refreshedData.property);
    setExistingVideos(loadedVideos);
    const featuredVideo =
      loadedVideos.find((video) => video.is_featured) || loadedVideos[0];
    setFeaturedVideoKey(
      featuredVideo ? `existing:${featuredVideo.id ?? "legacy"}` : null,
    );
  }

  async function handleSave({ submit = false } = {}) {
    setSaving(true);
    setError("");
    setErrorDetails([]);
    setSuccess("");

    const validated = validatePropertyDraftInput(form);
    if (!validated.ok) {
      setError(validated.error);
      setSaving(false);
      return;
    }

    // Status is never sent from here: submitting goes through the submit
    // endpoint so the listing is validated before an admin sees it.
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: validated.data.title,
        description: validated.data.description || form.description,
        city: String(form.city || "").trim() || null,
        area: String(form.area || "").trim() || null,
        phase: String(form.phase || "").trim() || null,
        address: String(form.address || "").trim() || null,
        size_unit: form.size_unit,
        size_value:
          validated.data.size_value != null
            ? validated.data.size_value
            : form.size_value
              ? Number(form.size_value)
              : null,
        price:
          validated.data.price != null
            ? validated.data.price
            : form.price
              ? Number(form.price)
              : null,
        price_currency:
          validated.data.price_currency ||
          form.price_currency ||
          DEFAULT_PRICE_CURRENCY,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to save.");
      setSaving(false);
      return;
    }

    // Category / featured / order changes on images that already exist.
    if (existingImages.length > 0) {
      const metaRes = await fetch(`/api/properties/${propertyId}/images`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: existingImages.map((image, index) => ({
            id: image.id,
            title: image.image_title || "",
            category: image.category || null,
            sortOrder: index,
            isFeatured: featuredKey === `existing:${image.id}`,
          })),
        }),
      });
      if (!metaRes.ok) {
        const metaData = await metaRes.json().catch(() => ({}));
        setError(metaData.error || "Could not update image details.");
        setSaving(false);
        return;
      }
    }

    if (deletedImageIds.length > 0) {
      const deleteRes = await fetch(`/api/properties/${propertyId}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: deletedImageIds }),
      });
      if (!deleteRes.ok) {
        const deleteData = await deleteRes.json().catch(() => ({}));
        setError(deleteData.error || "Could not remove some images.");
        setSaving(false);
        return;
      }
      setDeletedImageIds([]);
    }

    if (newImages.length > 0) {
      const fd = new FormData();
      newImages.forEach((item, index) => {
        fd.append("images", item.file);
        fd.append("imageOrder", String(existingImages.length + index));
        fd.append("imageCategories", item.category || "");
        fd.append("isFeatured", featuredKey === `new:${item.key}` ? "1" : "0");
      });
      const imageRes = await fetch(`/api/properties/${propertyId}/images`, {
        method: "POST",
        body: fd,
      });
      const imageData = await imageRes.json().catch(() => ({}));
      if (!imageRes.ok) {
        setError(imageData.error || "Could not upload property images.");
        setSaving(false);
        return;
      }
      newImages.forEach((item) => URL.revokeObjectURL(item.url));
      setNewImages([]);
    }

    if (existingImages.length > 0 || newImages.length > 0) {
      const refreshed = await fetch(`/api/properties/${propertyId}`);
      const refreshedData = await refreshed.json().catch(() => ({}));
      const refreshedImages = refreshedData.property?.images || [];
      if (refreshed.ok) {
        setExistingImages(refreshedImages);
        const featured =
          refreshedImages.find((image) => image.is_featured) ||
          refreshedImages[0];
        setFeaturedKey(featured ? `existing:${featured.id}` : null);
      }
    }

    if (newVideos.length > 0) {
      for (let i = 0; i < newVideos.length; i += 1) {
        const category = newVideos[i].category;
        if (!category || !String(category).trim()) {
          setError("Please add a category for all new videos.");
          setSaving(false);
          return;
        }
      }

      const fd = new FormData();
      newVideos.forEach((item, index) => {
        fd.append("videos", item.file);
        fd.append("videoOrder", String(existingVideos.length + index));
        fd.append("videoCategories", item.category || "");
        fd.append(
          "isFeatured",
          featuredVideoKey === `new:${item.key}` ? "1" : "0",
        );
      });
      const videoRes = await fetch(`/api/properties/${propertyId}/videos`, {
        method: "POST",
        body: fd,
      });
      const videoData = await videoRes.json().catch(() => ({}));
      if (!videoRes.ok) {
        setError(videoData.error || "Could not upload property videos.");
        setSaving(false);
        return;
      }
      newVideos.forEach((item) => URL.revokeObjectURL(item.url));
      setNewVideos([]);
      if (newVideoInputRef.current) newVideoInputRef.current.value = "";
      await refreshVideosFromServer();
    }

    setForm((prev) => ({ ...prev, status: data.status || prev.status }));

    if (submit) {
      const submitRes = await fetch(`/api/properties/${propertyId}/submit`, {
        method: "POST",
      });
      const submitData = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) {
        setError(
          submitData.error || "Could not submit this property for approval.",
        );
        setErrorDetails(
          Array.isArray(submitData.errors) ? submitData.errors : [],
        );
        setSuccess("Your changes were saved, but the listing was not submitted.");
        setSaving(false);
        return;
      }
      setForm((prev) => ({ ...prev, status: "pending_approval" }));
      setRejection(null);
      setSuccess("Property submitted for approval.");
      setSaving(false);
      return;
    }

    setSuccess("Property saved.");
    setSaving(false);
  }

  const isPending = form.status === "pending_approval";
  const isRejected = form.status === "rejected";
  const isDraft = form.status === "draft";
  const canSubmit = isDraft || isRejected;

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title={isPending ? "Property Under Review" : "Edit Property"}
      subtitle={
        isPending
          ? "Locked until an admin finishes reviewing this listing"
          : "Update listing details and submission status"
      }
    >
      <div className={ui.formCard}>
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Opening property…"
          />
        ) : null}
        {error ? (
          <div className={ui.error}>
            <p className={ui.noticeTitle}>{error}</p>
            {errorDetails.length > 0 ? (
              <ul className={ui.errorList}>
                {errorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {success ? <p className={ui.success}>{success}</p> : null}

        {!loading ? (
          <>
            {isPending ? (
              <div className={ui.noticePending}>
                <p className={ui.noticeTitle}>Waiting for admin review</p>
                You will be able to edit this listing again once it has been
                approved or rejected.
              </div>
            ) : null}
            {isRejected ? (
              <div className={ui.noticeRejected}>
                <p className={ui.noticeTitle}>
                  Your property was rejected. Please review the reason and update
                  it.
                </p>
                {rejection?.reason || "No reason was recorded."}
              </div>
            ) : null}
            <p className={ui.muted}>
              Current status: <strong>{String(form.status).replace(/_/g, " ")}</strong>
            </p>
            <label className={ui.field}>
              <span className={ui.label}>Title</span>
              <input
                className={ui.input}
                value={form.title}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className={ui.field}>
              <span className={ui.label}>Property Videos (Optional)</span>
              {existingVideos.length === 0 && newVideos.length === 0 ? (
                <p className={ui.muted}>No videos uploaded yet.</p>
              ) : null}

              {existingVideos.length > 0 ? (
                <div className={ui.imageManager}>
                  {existingVideos.map((video, index) => {
                    const rowKey = `existing:${video.id ?? "legacy"}`;
                    const title = videoTitle(video, index);
                    const isFeatured =
                      featuredVideoKey === rowKey ||
                      (!featuredVideoKey && Boolean(video.is_featured));
                    return (
                      <div
                        key={video.id ?? `legacy-${index}`}
                        className={ui.imageCard}
                      >
                        <div className={ui.imageCardThumb}>
                          <button
                            type="button"
                            className={ui.thumbPreviewBtn}
                            aria-label={`Preview ${title}`}
                            disabled={isPending}
                            onClick={() => {
                              setVideoPreviewIndex(index);
                              setVideoPreviewOpen(true);
                            }}
                          >
                            {video.thumbnail_url || video.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={video.thumbnail_url || video.thumbnail}
                                alt=""
                              />
                            ) : (
                              <video
                                src={video.video_url}
                                muted
                                playsInline
                                preload="none"
                              />
                            )}
                            <PropertyWatermark text={watermarkText} compact />
                            <span
                              className={ui.thumbPlayOverlay}
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M8 5.5v13l11-6.5-11-6.5z"
                                  fill="currentColor"
                                />
                              </svg>
                            </span>
                            {isFeatured ? (
                              <span className={ui.featuredTag}>Featured</span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className={ui.thumbRemoveBtn}
                            disabled={
                              isPending || deletingVideoKey === rowKey
                            }
                            aria-label={`Delete ${title}`}
                            onClick={() => removeExistingVideo(video, index)}
                          >
                            ×
                          </button>
                        </div>
                        <div className={ui.imageCardBody}>
                          <p className={ui.imageCardLabel}>{title}</p>
                          <p className={ui.muted}>
                            Saved video · Order {index + 1}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {newVideos.length > 0 ? (
                <>
                  <span className={ui.label}>New videos (save to upload)</span>
                  <div className={ui.imageManager}>
                    {newVideos.map((item, index) => {
                      const previewAt = existingVideos.length + index;
                      return (
                        <div key={item.key} className={ui.imageCard}>
                          <div className={ui.imageCardThumb}>
                            <button
                              type="button"
                              className={ui.thumbPreviewBtn}
                              aria-label={`Preview new video ${index + 1}`}
                              disabled={isPending}
                              onClick={() => {
                                setVideoPreviewIndex(previewAt);
                                setVideoPreviewOpen(true);
                              }}
                            >
                              <video
                                src={item.url}
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <PropertyWatermark text={watermarkText} compact />
                              <span
                                className={ui.thumbPlayOverlay}
                                aria-hidden="true"
                              >
                                <svg viewBox="0 0 24 24" fill="none">
                                  <path
                                    d="M8 5.5v13l11-6.5-11-6.5z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </span>
                              {featuredVideoKey === `new:${item.key}` ? (
                                <span className={ui.featuredTag}>Featured</span>
                              ) : null}
                            </button>
                            <button
                              type="button"
                              className={ui.thumbRemoveBtn}
                              disabled={isPending}
                              aria-label={`Delete new video ${index + 1}`}
                              onClick={() => removeNewVideo(item.key)}
                            >
                              ×
                            </button>
                          </div>
                          <div className={ui.imageCardBody}>
                            <label className={ui.field}>
                              <span className={ui.imageCardLabel}>
                                Category
                              </span>
                              <ImageCategorySelect
                                className={ui.select}
                                inputClassName={ui.input}
                                value={item.category}
                                disabled={isPending}
                                ariaLabel={`Category for new video ${index + 1}`}
                                onChange={(category) =>
                                  setNewVideos((prev) =>
                                    prev.map((entry) =>
                                      entry.key === item.key
                                        ? {
                                            ...entry,
                                            category: category || "",
                                          }
                                        : entry,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <div className={ui.imageCardMeta}>
                              <label className={ui.imageCardCheck}>
                                <input
                                  type="radio"
                                  name="featured-video"
                                  checked={
                                    featuredVideoKey === `new:${item.key}`
                                  }
                                  disabled={isPending}
                                  onChange={() =>
                                    setFeaturedVideoKey(`new:${item.key}`)
                                  }
                                />
                                Featured video
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {existingVideos.length + newVideos.length < MAX_PROPERTY_VIDEOS ? (
                <div className={ui.filePicker}>
                  <input
                    ref={newVideoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    multiple
                    className={ui.srOnlyInput}
                    disabled={isPending}
                    onChange={(e) => {
                      addVideos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={ui.filePickerBtn}
                    disabled={isPending}
                    onClick={() => newVideoInputRef.current?.click()}
                  >
                    + Upload More Videos
                  </button>
                  <span className={ui.filePickerStatus}>
                    {existingVideos.length + newVideos.length === 0
                      ? "No videos selected"
                      : `${existingVideos.length + newVideos.length} of ${MAX_PROPERTY_VIDEOS} videos`}
                  </span>
                </div>
              ) : (
                <p className={ui.muted}>
                  Maximum of {MAX_PROPERTY_VIDEOS} videos reached. Delete a video
                  to upload another.
                </p>
              )}
              <p className={ui.muted}>
                MP4, WebM, or MOV. Maximum {MAX_PROPERTY_VIDEOS} videos.
                New uploads are saved when you click Save.
              </p>
            </div>
            <label className={ui.field}>
              <span className={ui.label}>Description</span>
              <textarea
                className={ui.textarea}
                value={form.description}
                disabled={isPending}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>City</span>
              <input
                className={ui.input}
                value={form.city}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Lahore"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Area</span>
              <input
                className={ui.input}
                value={form.area}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="e.g. DHA,Gulberg"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phase</span>
              <input
                className={ui.input}
                value={form.phase}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, phase: e.target.value })}
                placeholder="e.g. Phase 6 / Sector B"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Address</span>
              <input
                className={ui.input}
                value={form.address}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="House number, street, block, road, full address"
              />
            </label>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Size</span>
                <input
                  className={ui.input}
                  type="number"
                  value={form.size_value}
                  disabled={isPending}
                  onChange={(e) =>
                    setForm({ ...form, size_value: e.target.value })
                  }
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Unit</span>
                <select
                  className={ui.select}
                  value={form.size_unit}
                  disabled={isPending}
                  onChange={(e) =>
                    setForm({ ...form, size_unit: e.target.value })
                  }
                >
                  <option value="marla">Marla</option>
                  <option value="kanal">Kanal</option>
                  <option value="sqft">Sqft</option>
                </select>
              </label>
            </div>
            <div className={ui.field}>
              <span className={ui.label}>Price</span>
              <PriceCurrencyInput
                amount={form.price}
                currency={form.price_currency}
                disabled={isPending}
                onAmountChange={(value) =>
                  setForm({ ...form, price: value })
                }
                onCurrencyChange={(value) =>
                  setForm({ ...form, price_currency: value })
                }
              />
            </div>
            <div className={ui.field}>
              <span className={ui.label}>Property Images</span>
              {existingImages.length === 0 ? (
                <p className={ui.muted}>No images uploaded yet.</p>
              ) : (
                <div className={ui.imageManager}>
                  {existingImages.map((image, index) => (
                    <div key={image.id} className={ui.imageCard}>
                      <button
                        type="button"
                        className={ui.imageCardThumb}
                        aria-label={`Preview image ${index + 1}`}
                        onClick={() => {
                          setPreviewIndex(index);
                          setPreviewOpen(true);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.image_url} alt={image.image_title || ""} />
                        {featuredKey === `existing:${image.id}` ? (
                          <span className={ui.featuredTag}>Featured</span>
                        ) : null}
                      </button>
                      <div className={ui.imageCardBody}>
                        <label className={ui.field}>
                          <span className={ui.imageCardLabel}>Category</span>
                        <ImageCategorySelect
                          className={ui.select}
                          inputClassName={ui.input}
                          value={image.category}
                          disabled={isPending}
                          ariaLabel={`Category for image ${index + 1}`}
                          onChange={(category) =>
                            updateExistingImage(image.id, { category })
                          }
                        />
                        </label>
                        <div className={ui.imageCardMeta}>
                          <label className={ui.imageCardCheck}>
                            <input
                              type="radio"
                              name="featured-image"
                              checked={featuredKey === `existing:${image.id}`}
                              disabled={isPending}
                              onChange={() =>
                                setFeaturedKey(`existing:${image.id}`)
                              }
                            />
                            Featured image
                          </label>
                          <span className={ui.imageCardLabel}>
                            Order {index + 1}
                          </span>
                          <div className={ui.imageCardActions}>
                            <button
                              type="button"
                              className={ui.iconBtn}
                              disabled={isPending || index === 0}
                              aria-label={`Move image ${index + 1} up`}
                              onClick={() => moveExistingImage(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={ui.iconBtn}
                              disabled={
                                isPending || index === existingImages.length - 1
                              }
                              aria-label={`Move image ${index + 1} down`}
                              onClick={() => moveExistingImage(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className={`${ui.iconBtn} ${ui.iconBtnDanger}`}
                              disabled={isPending}
                              aria-label={`Remove image ${index + 1}`}
                              onClick={() => removeExistingImage(image.id)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className={ui.field}>
              <span className={ui.label}>Add images</span>
            </label>
            {newImages.length > 0 ? (
              <div className={ui.imageManager}>
                {newImages.map((item, index) => (
                  <div key={item.key} className={ui.imageCard}>
                    <button
                      type="button"
                      className={ui.imageCardThumb}
                      aria-label={`Preview new image ${index + 1}`}
                      onClick={() => {
                        setPreviewIndex(existingImages.length + index);
                        setPreviewOpen(true);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="" />
                      {featuredKey === `new:${item.key}` ? (
                        <span className={ui.featuredTag}>Featured</span>
                      ) : null}
                    </button>
                    <div className={ui.imageCardBody}>
                      <label className={ui.field}>
                        <span className={ui.imageCardLabel}>Category</span>
                        <ImageCategorySelect
                          className={ui.select}
                          inputClassName={ui.input}
                          value={item.category}
                          disabled={isPending}
                          ariaLabel={`Category for new image ${index + 1}`}
                          onChange={(category) =>
                            setNewImages((prev) =>
                              prev.map((entry) =>
                                entry.key === item.key
                                  ? { ...entry, category: category || "" }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </label>
                      <div className={ui.imageCardMeta}>
                        <label className={ui.imageCardCheck}>
                          <input
                            type="radio"
                            name="featured-image"
                            checked={featuredKey === `new:${item.key}`}
                            disabled={isPending}
                            onChange={() => setFeaturedKey(`new:${item.key}`)}
                          />
                          Featured image
                        </label>
                        <div className={ui.imageCardActions}>
                          <button
                            type="button"
                            className={`${ui.iconBtn} ${ui.iconBtnDanger}`}
                            disabled={isPending}
                            aria-label={`Remove new image ${index + 1}`}
                            onClick={() => removeNewImage(item.key)}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className={ui.imageUploadActions}>
              <input
                ref={newFileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={isPending}
                className={ui.srOnlyInput}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className={ui.btnSecondary}
                disabled={
                  isPending ||
                  existingImages.length + newImages.length >= MAX_PROPERTY_IMAGES
                }
                onClick={() => newFileInputRef.current?.click()}
              >
                {newImages.length > 0 || existingImages.length > 0
                  ? "+ Upload More Images"
                  : "+ Upload Images"}
              </button>
              {newImages.length > 0 ? (
                <button
                  type="button"
                  className={ui.btnTextDanger}
                  disabled={isPending}
                  onClick={clearAllNewImages}
                >
                  Clear New Images
                </button>
              ) : null}
            </div>

            <div className={ui.formActions}>
              {isPending ? null : (
                <button
                  type="button"
                  className={ui.btnGhost}
                  disabled={saving}
                  onClick={() => handleSave()}
                >
                  {saving ? "Saving…" : isDraft ? "Save Draft" : "Save Changes"}
                </button>
              )}
              {canSubmit ? (
                <button
                  type="button"
                  className={ui.btnPrimary}
                  disabled={saving}
                  onClick={() => handleSave({ submit: true })}
                >
                  {isRejected ? "Save & Resubmit" : "Submit For Approval"}
                </button>
              ) : null}
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => router.push(`${base}/properties`)}
              >
                Back to list
              </button>
            </div>
          </>
        ) : null}
      </div>

      <ImagePreviewModal
        images={[
          ...existingImages.map((image) => ({
            ...image,
            featured: featuredKey === `existing:${image.id}`,
          })),
          ...newImages.map((item) => ({
            url: item.url,
            category: item.category,
            featured: featuredKey === `new:${item.key}`,
          })),
        ]}
        currentIndex={previewIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <VideoPreviewModal
        videos={[
          ...existingVideos.map((video) => ({
            ...video,
            featured:
              featuredVideoKey === `existing:${video.id ?? "legacy"}`,
          })),
          ...newVideos.map((item) => ({
            url: item.url,
            category: item.category,
            featured: featuredVideoKey === `new:${item.key}`,
          })),
        ]}
        currentIndex={videoPreviewIndex}
        isOpen={videoPreviewOpen}
        onClose={() => setVideoPreviewOpen(false)}
        watermarkText={watermarkText}
      />
    </AgentPortalShell>
  );
}
