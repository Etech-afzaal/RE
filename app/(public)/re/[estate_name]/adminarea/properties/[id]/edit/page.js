"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ImageCategorySelect from "@/components/ImageCategorySelect";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import {
  MAX_PROPERTY_IMAGES,
  imageLimitErrorMessage,
} from "@/lib/imageUpload";
import ui from "@/components/agent-portal/portal.module.css";

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const propertyId = params.id;
  const base = `/re/${encodeURIComponent(username)}/adminarea`;

  const [form, setForm] = useState({
    title: "",
    description: "",
    size_value: "",
    size_unit: "marla",
    price: "",
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
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [newVideo, setNewVideo] = useState(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    (async () => {
      const res = await fetch(`/api/properties/${propertyId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Property not found.");
        setLoading(false);
        return;
      }
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
      setCurrentVideoUrl(p.video_url || "");
      setLoading(false);
    })();
  }, [status, propertyId, router]);

  useEffect(() => {
    return () => {
      newImages.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // Previews are revoked when leaving the page, not on every list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList) {
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

    const added = incoming.slice(0, remaining).map((file) => ({
      key: `n${newImageKey.current++}`,
      file,
      url: URL.createObjectURL(file),
      category: "",
    }));
    if (added.length === 0) return;
    setNewImages((prev) => [...prev, ...added]);
    setFeaturedKey((prev) => prev ?? `new:${added[0].key}`);
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

  async function handleSave({ submit = false } = {}) {
    setSaving(true);
    setError("");
    setErrorDetails([]);
    setSuccess("");

    // Status is never sent from here: submitting goes through the submit
    // endpoint so the listing is validated before an admin sees it.
    const res = await fetch(`/api/properties/${propertyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        city: String(form.city || "").trim() || null,
        area: String(form.area || "").trim() || null,
        phase: String(form.phase || "").trim() || null,
        address: String(form.address || "").trim() || null,
        size_unit: form.size_unit,
        size_value: form.size_value ? Number(form.size_value) : null,
        price: form.price ? Number(form.price) : null,
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

    if (removeVideo && currentVideoUrl) {
      const removeRes = await fetch(`/api/properties/${propertyId}/video`, {
        method: "DELETE",
      });
      const removeData = await removeRes.json().catch(() => ({}));
      if (!removeRes.ok) {
        setError(removeData.error || "Could not remove property video.");
        setSaving(false);
        return;
      }
      setCurrentVideoUrl("");
      setRemoveVideo(false);
    }

    if (newVideo) {
      const fd = new FormData();
      fd.append("video", newVideo);
      const videoRes = await fetch(`/api/properties/${propertyId}/video`, {
        method: "POST",
        body: fd,
      });
      const videoData = await videoRes.json().catch(() => ({}));
      if (!videoRes.ok) {
        setError(videoData.error || "Could not upload property video.");
        setSaving(false);
        return;
      }
      setCurrentVideoUrl(videoData.videoUrl || "");
      setNewVideo(null);
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
        {loading ? <p className={ui.muted}>Loading…</p> : null}
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
              <span className={ui.label}>Property Video (Optional)</span>
              {currentVideoUrl && !removeVideo ? (
                <>
                  <video controls preload="metadata" src={currentVideoUrl} style={{ width: "100%", borderRadius: "12px" }}>
                    Your browser does not support this video format.
                  </video>
                  <label className={ui.muted}>
                    <input
                      type="checkbox"
                      checked={removeVideo}
                      disabled={isPending}
                      onChange={(e) => setRemoveVideo(e.target.checked)}
                    />{" "}
                    Remove current video
                  </label>
                </>
              ) : currentVideoUrl ? (
                <p className={ui.muted}>The current video will be removed when you save.</p>
              ) : null}
              <input
                className={ui.input}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg"
                disabled={isPending}
                onChange={(e) => setNewVideo(e.target.files?.[0] || null)}
              />
              <p className={ui.muted}>MP4, WebM, MOV, or OGG. One video only.</p>
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
                placeholder="Lahore"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Area</span>
              <input
                className={ui.input}
                value={form.area}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="DHA"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phase</span>
              <input
                className={ui.input}
                value={form.phase}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, phase: e.target.value })}
                placeholder="Phase 5"
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
            <label className={ui.field}>
              <span className={ui.label}>Price (PKR)</span>
              <input
                className={ui.input}
                type="number"
                value={form.price}
                disabled={isPending}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
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
    </AgentPortalShell>
  );
}
