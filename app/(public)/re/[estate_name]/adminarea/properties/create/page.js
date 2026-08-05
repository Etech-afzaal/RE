"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import ImageCategorySelect from "@/components/ImageCategorySelect";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import { needsCustomImageCategory } from "@/lib/imageCategories";
import {
  MAX_PROPERTY_IMAGES,
  imageLimitErrorMessage,
} from "@/lib/imageUpload";
import { MAX_PROPERTY_VIDEOS, videoLimitErrorMessage } from "@/lib/videoUpload";
import ui from "@/components/agent-portal/portal.module.css";

const STEPS = [
  "Basic Information",
  "Location",
  "Property Details",
  "Images",
  "Video",
  "Actions",
];

function buildTitle(title, propertyType) {
  const t = String(title || "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (propertyType === "rent" && !lower.includes("rent")) {
    return `${t} for Rent`;
  }
  if (propertyType === "plot" && !lower.includes("plot")) {
    return `${t} Plot`;
  }
  if (propertyType === "sale" && !lower.includes("sale") && !lower.includes("rent") && !lower.includes("plot")) {
    return `${t} for Sale`;
  }
  return t;
}

function buildLocation({ area, phase, address }) {
  return [area, phase, address].map((s) => String(s || "").trim()).filter(Boolean).join(", ");
}

function buildDescription({ description, bedrooms, bathrooms, parking }) {
  const parts = [String(description || "").trim()];
  const meta = [];
  if (bedrooms) meta.push(`Bedrooms: ${bedrooms}`);
  if (bathrooms) meta.push(`Bathrooms: ${bathrooms}`);
  if (parking) meta.push(`Parking: ${parking}`);
  if (meta.length) parts.push(meta.join(" | "));
  return parts.filter(Boolean).join("\n\n") || null;
}

export default function CreatePropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/adminarea`;

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [busyAction, setBusyAction] = useState(null); // null | "draft" | "submit"
  const [submitSuccessOpen, setSubmitSuccessOpen] = useState(false);
  // Each entry: { file, url, category, isFeatured }. Position in the array is
  // the display order sent to the API as imageOrder. Capped at MAX_PROPERTY_IMAGES.
  const [images, setImages] = useState([]);
  // Same shape as images; capped at MAX_PROPERTY_VIDEOS.
  const [videos, setVideos] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [form, setForm] = useState({
    title: "",
    propertyType: "sale",
    description: "",
    area: "",
    phase: "",
    address: "",
    size_value: "",
    size_unit: "marla",
    bedrooms: "",
    bathrooms: "",
    parking: "",
    price: "",
  });

  useEffect(() => {
    return () => {
      images.forEach((item) => URL.revokeObjectURL(item.url));
      videos.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // Object URLs are revoked once, when leaving the page; revoking on every
    // change would break previews that are still on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "unauthenticated") {
    router.replace("/agent/login");
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const remaining = Math.max(0, MAX_PROPERTY_IMAGES - images.length);
    if (remaining === 0 || incoming.length > remaining) {
      setError(imageLimitErrorMessage());
    } else {
      setError("");
    }
    if (remaining === 0) return;

    setImages((prev) => {
      const accepted = incoming.slice(0, remaining).map((file) => ({
        file,
        url: URL.createObjectURL(file),
        category: "",
        isFeatured: false,
      }));
      if (accepted.length === 0) return prev;
      const next = [...prev, ...accepted];
      if (!next.some((item) => item.isFeatured)) next[0].isFeatured = true;
      return next;
    });
  }

  function updateImage(index, changes) {
    setImages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
  }

  /** Exactly one image can be the featured one. */
  function setFeatured(index) {
    setImages((prev) =>
      prev.map((item, i) => ({ ...item, isFeatured: i === index })),
    );
  }

  function moveImage(index, offset) {
    setImages((prev) => {
      const target = index + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeImage(index) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((item) => item.isFeatured)) {
        next[0] = { ...next[0], isFeatured: true };
      }
      return next;
    });
  }

  function clearAllImages() {
    const confirmed = window.confirm(
      "Remove all uploaded images?\n\nThis will remove all selected images from this property.",
    );
    if (!confirmed) return;
    setImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addVideos(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const remaining = Math.max(0, MAX_PROPERTY_VIDEOS - videos.length);
    if (remaining === 0 || incoming.length > remaining) {
      setError(videoLimitErrorMessage());
    } else {
      setError("");
    }
    if (remaining === 0) return;

    const accepted = incoming.slice(0, remaining).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      category: "",
      isFeatured: false,
    }));

    setVideos((prev) => {
      const next = [...prev, ...accepted];
      if (!next.some((item) => item.isFeatured)) next[0].isFeatured = true;
      return next;
    });
  }

  function updateVideo(index, changes) {
    setVideos((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
  }

  /** Exactly one video can be the featured walkthrough. */
  function setFeaturedVideo(index) {
    setVideos((prev) =>
      prev.map((item, i) => ({ ...item, isFeatured: i === index })),
    );
  }

  function moveVideo(index, offset) {
    setVideos((prev) => {
      const target = index + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeVideo(index) {
    setVideos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((item) => item.isFeatured)) {
        next[0] = { ...next[0], isFeatured: true };
      }
      return next;
    });
    setError("");
  }

  function clearAllVideos() {
    const confirmed = window.confirm(
      "Remove all uploaded videos?\n\nThis will remove all selected videos from this property.",
    );
    if (!confirmed) return;
    setVideos((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    if (videoInputRef.current) videoInputRef.current.value = "";
    setError("");
  }

  function validateImagesStep() {
    if (images.length === 0) {
      return "Please upload at least one image.";
    }
    for (let i = 0; i < images.length; i += 1) {
      const category = images[i].category;
      if (!category || !String(category).trim()) {
        return "Please add a category for all images.";
      }
      if (needsCustomImageCategory(category)) {
        return "Please enter custom category.";
      }
    }
    return null;
  }

  function validateVideosStep() {
    if (videos.length === 0) return null;
    for (let i = 0; i < videos.length; i += 1) {
      const category = videos[i].category;
      if (!category || !String(category).trim()) {
        return "Please add a category for all videos.";
      }
      if (needsCustomImageCategory(category)) {
        return "Please enter custom category.";
      }
    }
    return null;
  }

  function handleContinue() {
    setError("");
    setErrorDetails([]);
    if (step === 3) {
      const imageError = validateImagesStep();
      if (imageError) {
        setError(imageError);
        return;
      }
    }
    if (step === 4) {
      const videoError = validateVideosStep();
      if (videoError) {
        setError(videoError);
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  }

  async function save({ submit = false } = {}) {
    setError("");
    setErrorDetails([]);
    const title = buildTitle(form.title, form.propertyType);
    if (!title) {
      setError("Title is required.");
      setStep(0);
      return;
    }

    setBusyAction(submit ? "submit" : "draft");
    try {
      const createRes = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: buildDescription(form),
          location: buildLocation(form) || null,
          size_value: form.size_value ? Number(form.size_value) : null,
          size_unit: form.size_unit || "marla",
          price: form.price ? Number(form.price) : null,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createData.error || "Could not create property.");
      }

      const propertyId = createData.propertyId;
      if (images.length > 0 && propertyId) {
        const fd = new FormData();
        images.forEach((item, index) => {
          fd.append("images", item.file);
          fd.append("imageOrder", String(index));
          fd.append("imageCategories", item.category || "");
          fd.append("isFeatured", item.isFeatured ? "1" : "0");
        });
        const imageRes = await fetch(`/api/properties/${propertyId}/images`, {
          method: "POST",
          body: fd,
        });
        const imageData = await imageRes.json().catch(() => ({}));
        if (!imageRes.ok) {
          throw new Error(imageData.error || "Could not upload property images.");
        }
      }

      if (videos.length > 0 && propertyId) {
        const fd = new FormData();
        videos.forEach((item, index) => {
          fd.append("videos", item.file);
          fd.append("videoOrder", String(index));
          fd.append("videoCategories", item.category || "");
          fd.append("isFeatured", item.isFeatured ? "1" : "0");
        });
        const videoRes = await fetch(`/api/properties/${propertyId}/videos`, {
          method: "POST",
          body: fd,
        });
        const videoData = await videoRes.json().catch(() => ({}));
        if (!videoRes.ok) {
          throw new Error(videoData.error || "Could not upload property videos.");
        }
      }

      // Submission happens after the uploads so the listing can be validated
      // against its real images.
      if (submit && propertyId) {
        const submitRes = await fetch(`/api/properties/${propertyId}/submit`, {
          method: "POST",
        });
        const submitData = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok) {
          setError("Unable to submit property. Please try again.");
          setErrorDetails(
            Array.isArray(submitData.errors) ? submitData.errors : [],
          );
          return;
        }
        setSubmitSuccessOpen(true);
        return;
      }

      router.push(`${base}/properties`);
    } catch (err) {
      if (submit) {
        setError("Unable to submit property. Please try again.");
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setBusyAction(null);
    }
  }

  function handleSubmitSuccessContinue() {
    setSubmitSuccessOpen(false);
    router.push(`${base}/properties`);
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Add Property"
      subtitle="Create a draft or submit for approval"
    >
      <div className={ui.formCard}>
        <div className={ui.steps}>
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={`${ui.stepPill} ${step === index ? ui.stepPillActive : ""}`}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

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

        {step === 0 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>Title</span>
              <input
                className={ui.input}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="10 Marla House in DHA Phase 5"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Property type</span>
              <select
                className={ui.select}
                value={form.propertyType}
                onChange={(e) => update("propertyType", e.target.value)}
              >
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
                <option value="plot">Plot</option>
              </select>
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Description</span>
              <textarea
                className={ui.textarea}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe the property"
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>Area</span>
              <input
                className={ui.input}
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="DHA Lahore"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phase</span>
              <input
                className={ui.input}
                value={form.phase}
                onChange={(e) => update("phase", e.target.value)}
                placeholder="Phase 5"
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Address</span>
              <input
                className={ui.input}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Block / street"
              />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Size</span>
                <input
                  className={ui.input}
                  type="number"
                  value={form.size_value}
                  onChange={(e) => update("size_value", e.target.value)}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Unit</span>
                <select
                  className={ui.select}
                  value={form.size_unit}
                  onChange={(e) => update("size_unit", e.target.value)}
                >
                  <option value="marla">Marla</option>
                  <option value="kanal">Kanal</option>
                  <option value="sqft">Sqft</option>
                </select>
              </label>
            </div>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Bedrooms</span>
                <input
                  className={ui.input}
                  value={form.bedrooms}
                  onChange={(e) => update("bedrooms", e.target.value)}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Bathrooms</span>
                <input
                  className={ui.input}
                  value={form.bathrooms}
                  onChange={(e) => update("bathrooms", e.target.value)}
                />
              </label>
            </div>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Parking</span>
                <input
                  className={ui.input}
                  value={form.parking}
                  onChange={(e) => update("parking", e.target.value)}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Price (PKR)</span>
                <input
                  className={ui.input}
                  type="number"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <span className={ui.label}>Property Images</span>

            {images.length > 0 ? (
              <>
                <span className={ui.label}>Uploaded Images</span>
                <div className={ui.imageManager}>
                  {images.map((item, index) => (
                    <div key={item.url} className={ui.imageCard}>
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
                        <img src={item.url} alt="" />
                        {item.isFeatured ? (
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
                            ariaLabel={`Category for image ${index + 1}`}
                            onChange={(category) =>
                              updateImage(index, { category: category || "" })
                            }
                          />
                        </label>
                        <div className={ui.imageCardMeta}>
                          <label className={ui.imageCardCheck}>
                            <input
                              type="radio"
                              name="featured-image"
                              checked={item.isFeatured}
                              onChange={() => setFeatured(index)}
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
                              disabled={index === 0}
                              aria-label={`Move image ${index + 1} up`}
                              onClick={() => moveImage(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={ui.iconBtn}
                              disabled={index === images.length - 1}
                              aria-label={`Move image ${index + 1} down`}
                              onClick={() => moveImage(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className={`${ui.iconBtn} ${ui.iconBtnDanger}`}
                              aria-label={`Remove image ${index + 1}`}
                              onClick={() => removeImage(index)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className={ui.field}>
              <div className={ui.filePicker}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg,.jpg,.jpeg,.png,.webp"
                  multiple
                  className={ui.srOnlyInput}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={ui.filePickerBtn}
                  disabled={images.length >= MAX_PROPERTY_IMAGES}
                  onClick={() => fileInputRef.current?.click()}
                >
                  + Choose Images
                </button>
                <span className={ui.filePickerStatus}>
                  {images.length === 0
                    ? "No images selected"
                    : `${images.length} image${images.length === 1 ? "" : "s"} selected`}
                </span>
              </div>
              <p className={ui.muted}>
                Upload JPG, PNG, WEBP images. Maximum {MAX_PROPERTY_IMAGES}{" "}
                images allowed.
              </p>
            </div>

            {images.length > 0 ? (
              <div className={ui.imageUploadActions}>
                <button
                  type="button"
                  className={ui.btnTextDanger}
                  onClick={clearAllImages}
                >
                  Clear All Images
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <span className={ui.label}>Property Videos (Optional)</span>

            {videos.length > 0 ? (
              <>
                <span className={ui.label}>Uploaded Videos</span>
                <div className={ui.imageManager}>
                  {videos.map((item, index) => (
                    <div key={item.url} className={ui.imageCard}>
                      <div className={ui.imageCardThumb}>
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                        />
                        {item.isFeatured ? (
                          <span className={ui.featuredTag}>Featured</span>
                        ) : null}
                      </div>
                      <div className={ui.imageCardBody}>
                        <label className={ui.field}>
                          <span className={ui.imageCardLabel}>Category</span>
                          <ImageCategorySelect
                            className={ui.select}
                            inputClassName={ui.input}
                            value={item.category}
                            ariaLabel={`Category for video ${index + 1}`}
                            onChange={(category) =>
                              updateVideo(index, { category: category || "" })
                            }
                          />
                        </label>
                        <div className={ui.imageCardMeta}>
                          <label className={ui.imageCardCheck}>
                            <input
                              type="radio"
                              name="featured-video"
                              checked={item.isFeatured}
                              onChange={() => setFeaturedVideo(index)}
                            />
                            Featured video
                          </label>
                          <span className={ui.imageCardLabel}>
                            Order {index + 1}
                          </span>
                          <div className={ui.imageCardActions}>
                            <button
                              type="button"
                              className={ui.iconBtn}
                              disabled={index === 0}
                              aria-label={`Move video ${index + 1} up`}
                              onClick={() => moveVideo(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={ui.iconBtn}
                              disabled={index === videos.length - 1}
                              aria-label={`Move video ${index + 1} down`}
                              onClick={() => moveVideo(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className={`${ui.iconBtn} ${ui.iconBtnDanger}`}
                              aria-label={`Remove video ${index + 1}`}
                              onClick={() => removeVideo(index)}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className={ui.field}>
              <div className={ui.filePicker}>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg"
                  multiple
                  className={ui.srOnlyInput}
                  onChange={(e) => {
                    addVideos(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={ui.filePickerBtn}
                  disabled={videos.length >= MAX_PROPERTY_VIDEOS}
                  onClick={() => videoInputRef.current?.click()}
                >
                  + Choose Videos
                </button>
                <span className={ui.filePickerStatus}>
                  {videos.length === 0
                    ? "No videos selected"
                    : `${videos.length} video${videos.length === 1 ? "" : "s"} selected`}
                </span>
              </div>
              <p className={ui.muted}>
                Upload MP4, WebM, MOV videos. Maximum 3 videos allowed.
              </p>
            </div>

            {videos.length > 0 ? (
              <div className={ui.imageUploadActions}>
                <button
                  type="button"
                  className={ui.btnTextDanger}
                  onClick={clearAllVideos}
                >
                  Clear All Videos
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className={ui.muted}>
              Save as draft to continue later, or submit for admin approval.
              Drafts never appear on your public website. Submitting needs a
              title, description, location, price, property type, and at least
              one image.
            </p>
            <div className={ui.formActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={Boolean(busyAction)}
                onClick={() => save()}
              >
                {busyAction === "draft" ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                className={ui.btnPrimary}
                disabled={Boolean(busyAction)}
                onClick={() => save({ submit: true })}
              >
                {busyAction === "submit" ? "Submitting..." : "Submit For Approval"}
              </button>
            </div>
          </>
        ) : null}

        {step < 5 ? (
          <div className={ui.formActions}>
            {step > 0 ? (
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className={ui.btnPrimary}
              onClick={handleContinue}
            >
              Continue
            </button>
          </div>
        ) : null}
      </div>

      {submitSuccessOpen ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={`${ui.dialog} ${ui.dialogSuccess}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-success-title"
            aria-describedby="submit-success-description"
          >
            <div className={ui.dialogSuccessIcon} aria-hidden="true">
              ✓
            </div>
            <h2 id="submit-success-title" className={ui.dialogTitle}>
              Property Submitted Successfully
            </h2>
            <p id="submit-success-description" className={ui.dialogText}>
              Your property has been submitted for approval.
            </p>
            <p className={ui.dialogText}>
              Our team will review your listing. Once approved, it will be
              published on your public profile.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnPrimary}
                onClick={handleSubmitSuccessContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ImagePreviewModal
        images={images.map((item) => ({
          url: item.url,
          category: item.category,
          featured: item.isFeatured,
        }))}
        currentIndex={previewIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </AgentPortalShell>
  );
}
