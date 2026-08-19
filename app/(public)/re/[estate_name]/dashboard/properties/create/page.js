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
import { companyNameFromAgent } from "@/lib/agentBranding";
import { needsCustomImageCategory } from "@/lib/imageCategories";
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
  videoFormatErrorMessage,
  videoLimitErrorMessage,
  videoSizeErrorMessage,
  isVideoFile,
  MAX_PROPERTY_VIDEO_BYTES,
} from "@/lib/videoUpload";
import {
  DEFAULT_PRICE_CURRENCY,
  PROPERTY_WIZARD_STEPS,
  WIZARD_DIGIT_LIMITS,
  WIZARD_TEXT_LIMITS,
  getPropertyWizardFieldError,
  propertyFieldToWizardStep,
  sanitizeWizardCityInput,
  sanitizeWizardDigitInput,
  sanitizeWizardTextInput,
  validatePropertyWizardFields,
  validatePropertyWizardStep,
} from "@/lib/validators/propertyValidator";
import {
  isValidPropertyTypeSubtype,
  subtypesForType,
} from "@/lib/propertyTaxonomy";
import ui from "@/components/agent-portal/portal.module.css";
import PropertyMarketingSectionsEditor from "@/components/agent-portal/PropertyMarketingSectionsEditor";

const STEPS = [
  "Basic Information",
  "Location",
  "Property Details",
  "Images",
  "Video",
  "Actions",
];

function RequiredMark() {
  return (
    <span className={ui.requiredMark} aria-hidden="true">
      {" "}
      *
    </span>
  );
}

/** Always-rendered message slot so validation never shifts the layout. */
function FieldMessage({ id, error }) {
  return (
    <p
      id={id}
      className={ui.fieldMessage}
      role={error ? "alert" : undefined}
      aria-hidden={error ? undefined : true}
    >
      {error || ""}
    </p>
  );
}

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

function buildLocation({ city, area, phase }) {
  const areaPhase = [area, phase]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");
  const cityText = String(city || "").trim();
  if (areaPhase && cityText) return `${areaPhase}, ${cityText}`;
  if (areaPhase) return areaPhase;
  if (cityText) return cityText;
  return "";
}

function buildDescription({ description, bedrooms, bathrooms, parking }) {
  const parts = [String(description || "").trim()];
  const meta = [];
  if (bedrooms) meta.push(`Bedrooms: ${bedrooms}`);
  if (bathrooms) meta.push(`Bathrooms: ${bathrooms}`);
  if (String(parking || "").toLowerCase() === "yes") {
    meta.push("Parking: Yes");
  }
  if (meta.length) parts.push(meta.join(" | "));
  return parts.filter(Boolean).join("\n\n") || null;
}

export default function CreatePropertyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busyAction, setBusyAction] = useState(null); // null | "draft" | "submit"
  const [submitSuccessOpen, setSubmitSuccessOpen] = useState(false);
  // Reuse after first create so retries do not orphan duplicate drafts.
  const [createdPropertyId, setCreatedPropertyId] = useState(null);
  const imagesUploadedRef = useRef(false);
  const videosUploadedRef = useRef(false);
  // Each entry: { file, url, category, isFeatured }. Position in the array is
  // the display order sent to the API as imageOrder. Capped at MAX_PROPERTY_IMAGES.
  const [images, setImages] = useState([]);
  // Same shape as images; capped at MAX_PROPERTY_VIDEOS.
  const [videos, setVideos] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [watermarkText, setWatermarkText] = useState("");
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [form, setForm] = useState({
    title: "",
    propertyType: "sale",
    propertySubtype: "",
    description: "",
    city: "",
    area: "",
    phase: "",
    address: "",
    size_value: "",
    size_unit: "marla",
    bedrooms: "",
    bathrooms: "",
    parking: "No",
    price: "",
    price_currency: DEFAULT_PRICE_CURRENCY,
    property_highlights: [],
    why_this_home: [],
    location_advantages: [],
    investment_insights: [],
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status !== "authenticated") return;

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/agent/company-branding");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setWatermarkText(
        companyNameFromAgent(data.branding || session?.user),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router, session?.user]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <LoadingSpinner
        fullPage
        label="Loading"
        hint="Preparing property form…"
      />
    );
  }

  function clearStepFeedback() {
    setError("");
    setErrorDetails([]);
    setFieldErrors({});
  }

  function setLiveFieldError(field, nextForm, limitError = null) {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (limitError) {
        next[field] = limitError;
        return next;
      }
      const error = getPropertyWizardFieldError(field, nextForm);
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }

  function update(field, rawValue) {
    const previous = form[field];
    let value = rawValue;
    let limitError = null;
    const prevOpts = { previous };

    if (field === "city") {
      const sanitized = sanitizeWizardCityInput(
        rawValue,
        WIZARD_TEXT_LIMITS.city,
        prevOpts,
      );
      value = sanitized.value;
      limitError = sanitized.limitError;
    } else if (field === "area" || field === "phase") {
      const sanitized = sanitizeWizardTextInput(
        rawValue,
        WIZARD_TEXT_LIMITS[field],
        prevOpts,
      );
      value = sanitized.value;
      limitError = sanitized.limitError;
    } else if (field === "address") {
      const sanitized = sanitizeWizardTextInput(
        rawValue,
        WIZARD_TEXT_LIMITS.address,
        prevOpts,
      );
      value = sanitized.value;
      limitError = sanitized.limitError;
    } else if (field === "title") {
      const sanitized = sanitizeWizardTextInput(
        rawValue,
        WIZARD_TEXT_LIMITS.title,
        prevOpts,
      );
      value = sanitized.value;
      limitError = sanitized.limitError;
    } else if (field === "description") {
      const sanitized = sanitizeWizardTextInput(
        rawValue,
        WIZARD_TEXT_LIMITS.description,
        prevOpts,
      );
      value = sanitized.value;
      limitError = sanitized.limitError;
    } else if (
      field === "bedrooms" ||
      field === "bathrooms" ||
      field === "size_value" ||
      field === "price"
    ) {
      const sanitized = sanitizeWizardDigitInput(
        rawValue,
        WIZARD_DIGIT_LIMITS[field],
        prevOpts,
      );
      value = sanitized.value;
      limitError = sanitized.limitError;
    }

    const nextForm = { ...form, [field]: value };

    // Reset subtype when it is no longer valid for the new top-level type.
    if (field === "propertyType") {
      if (!isValidPropertyTypeSubtype(value, form.propertySubtype)) {
        nextForm.propertySubtype = "";
      }
    }

    setForm(nextForm);

    // Property type changes only need to re-check type + subtype field errors.
    if (field === "propertyType") {
      setFieldErrors((prev) => {
        const next = { ...prev };
        const typeError = getPropertyWizardFieldError("propertyType", nextForm);
        if (typeError) next.propertyType = typeError;
        else delete next.propertyType;
        const subtypeError = getPropertyWizardFieldError(
          "propertySubtype",
          nextForm,
        );
        if (subtypeError) next.propertySubtype = subtypeError;
        else delete next.propertySubtype;
        return next;
      });
      return;
    }

    if (field === "propertySubtype") {
      setFieldErrors((prev) => {
        const next = { ...prev };
        const subtypeError = getPropertyWizardFieldError(
          "propertySubtype",
          nextForm,
        );
        if (subtypeError) next.propertySubtype = subtypeError;
        else delete next.propertySubtype;
        return next;
      });
      return;
    }

    setLiveFieldError(field, nextForm, limitError);
  }

  function validateMediaStep(stepIndex) {
    if (stepIndex === PROPERTY_WIZARD_STEPS.IMAGES) {
      const imageError = validateImagesStep();
      if (imageError) {
        return {
          ok: false,
          fieldErrors: { images: imageError },
          field: "images",
          error: imageError,
        };
      }
    }
    if (stepIndex === PROPERTY_WIZARD_STEPS.VIDEO) {
      const videoError = validateVideosStep();
      if (videoError) {
        return {
          ok: false,
          fieldErrors: { videos: videoError },
          field: "videos",
          error: videoError,
        };
      }
    }
    return { ok: true, fieldErrors: {} };
  }

  function validateWizardStep(stepIndex) {
    if (
      stepIndex === PROPERTY_WIZARD_STEPS.IMAGES ||
      stepIndex === PROPERTY_WIZARD_STEPS.VIDEO
    ) {
      return validateMediaStep(stepIndex);
    }
    return validatePropertyWizardStep(stepIndex, form);
  }

  function isStepComplete(stepIndex) {
    // Actions has no required fields of its own.
    if (stepIndex === PROPERTY_WIZARD_STEPS.ACTIONS) return false;
    return validateWizardStep(stepIndex).ok;
  }

  function applyStepValidationFailure(result, stepIndex) {
    setStep(stepIndex);
    setFieldErrors(result.fieldErrors || {});
    setErrorDetails([]);
    setError(result.error || "Please complete the required fields.");
  }

  async function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const remaining = Math.max(0, MAX_PROPERTY_IMAGES - images.length);
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

    setImages((prev) => {
      const room = Math.max(0, MAX_PROPERTY_IMAGES - prev.length);
      const accepted = valid.slice(0, room).map((file) => ({
        file,
        url: URL.createObjectURL(file),
        category: "",
        isFeatured: false,
        heroDisplay: false,
      }));
      if (accepted.length === 0) return prev;
      const next = [...prev, ...accepted];
      if (!next.some((item) => item.isFeatured)) next[0].isFeatured = true;
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev.images) return prev;
      const next = { ...prev };
      delete next.images;
      return next;
    });
  }

  function updateImage(index, changes) {
    setImages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
    if (Object.prototype.hasOwnProperty.call(changes, "category")) {
      setFieldErrors((prev) => {
        if (!prev.images) return prev;
        const next = { ...prev };
        delete next.images;
        return next;
      });
    }
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

    const accepted = valid.map((file) => ({
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
    setFieldErrors((prev) => {
      if (!prev.videos) return prev;
      const next = { ...prev };
      delete next.videos;
      return next;
    });
  }

  function updateVideo(index, changes) {
    setVideos((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
    if (Object.prototype.hasOwnProperty.call(changes, "category")) {
      setFieldErrors((prev) => {
        if (!prev.videos) return prev;
        const next = { ...prev };
        delete next.videos;
        return next;
      });
    }
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
    const result = validateWizardStep(step);
    if (!result.ok) {
      applyStepValidationFailure(result, step);
      return;
    }
    clearStepFeedback();
    setStep((s) => Math.min(PROPERTY_WIZARD_STEPS.ACTIONS, s + 1));
  }

  function handleBack() {
    clearStepFeedback();
    setStep((s) => Math.max(0, s - 1));
  }

  function handleStepClick(targetStep) {
    if (targetStep === step) return;

    // Backward (and same-or-previous) navigation is always allowed.
    if (targetStep < step) {
      clearStepFeedback();
      setStep(targetStep);
      return;
    }

    // Forward jump: every previous step must be complete.
    for (let i = 0; i < targetStep; i += 1) {
      const result = validateWizardStep(i);
      if (!result.ok) {
        applyStepValidationFailure(result, i);
        return;
      }
    }

    clearStepFeedback();
    setStep(targetStep);
  }

  async function save({ submit = false } = {}) {
    clearStepFeedback();
    const title = buildTitle(form.title, form.propertyType);
    if (!title) {
      setFieldErrors({ title: "Title is required" });
      setError("Title is required");
      setStep(PROPERTY_WIZARD_STEPS.BASIC);
      return;
    }

    if (submit) {
      const formCheck = validatePropertyWizardFields(form);
      if (!formCheck.ok) {
        setFieldErrors(formCheck.fieldErrors);
        setError(formCheck.error);
        setStep(propertyFieldToWizardStep(formCheck.field));
        return;
      }

      const imageCheck = validateMediaStep(PROPERTY_WIZARD_STEPS.IMAGES);
      if (!imageCheck.ok) {
        applyStepValidationFailure(imageCheck, PROPERTY_WIZARD_STEPS.IMAGES);
        return;
      }

      const videoCheck = validateMediaStep(PROPERTY_WIZARD_STEPS.VIDEO);
      if (!videoCheck.ok) {
        applyStepValidationFailure(videoCheck, PROPERTY_WIZARD_STEPS.VIDEO);
        return;
      }
    }

    setBusyAction(submit ? "submit" : "draft");
    try {
      let propertyId = createdPropertyId;

      if (!propertyId) {
        const createRes = await fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            propertyType: form.propertyType,
            propertySubtype: form.propertySubtype,
            description: buildDescription(form),
            city: String(form.city || "").trim() || null,
            area: String(form.area || "").trim() || null,
            phase: String(form.phase || "").trim() || null,
            address: String(form.address || "").trim() || null,
            location: buildLocation(form) || null,
            size_value: form.size_value ? Number(form.size_value) : null,
            size_unit: form.size_unit || "marla",
            price: form.price ? Number(form.price) : null,
            price_currency: form.price_currency || DEFAULT_PRICE_CURRENCY,
            property_highlights: form.property_highlights,
            why_this_home: form.why_this_home,
            location_advantages: form.location_advantages,
            investment_insights: form.investment_insights,
          }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          throw new Error(createData.error || "Could not create property.");
        }
        propertyId = createData.propertyId;
        setCreatedPropertyId(propertyId);
      } else {
        // Update draft fields on retry so edits after a failed upload are kept.
        const updateRes = await fetch(`/api/properties/${propertyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            propertyType: form.propertyType,
            propertySubtype: form.propertySubtype,
            description: buildDescription(form),
            city: String(form.city || "").trim() || null,
            area: String(form.area || "").trim() || null,
            phase: String(form.phase || "").trim() || null,
            address: String(form.address || "").trim() || null,
            location: buildLocation(form) || null,
            size_value: form.size_value ? Number(form.size_value) : null,
            size_unit: form.size_unit || "marla",
            price: form.price ? Number(form.price) : null,
            price_currency: form.price_currency || DEFAULT_PRICE_CURRENCY,
            property_highlights: form.property_highlights,
            why_this_home: form.why_this_home,
            location_advantages: form.location_advantages,
            investment_insights: form.investment_insights,
          }),
        });
        const updateData = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) {
          throw new Error(updateData.error || "Could not update property.");
        }
      }

      if (images.length > 0 && propertyId && !imagesUploadedRef.current) {
        const fd = new FormData();
        images.forEach((item, index) => {
          fd.append("images", item.file);
          fd.append("imageOrder", String(index));
          fd.append("imageCategories", item.category || "");
          fd.append("isFeatured", item.isFeatured ? "1" : "0");
          fd.append("heroDisplay", item.heroDisplay ? "1" : "0");
        });
        const imageRes = await fetch(`/api/properties/${propertyId}/images`, {
          method: "POST",
          body: fd,
        });
        const imageData = await imageRes.json().catch(() => ({}));
        if (!imageRes.ok) {
          throw new Error(imageData.error || "Could not upload property images.");
        }
        imagesUploadedRef.current = true;
      }

      if (videos.length > 0 && propertyId && !videosUploadedRef.current) {
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
        videosUploadedRef.current = true;
      }

      // Submission happens after the uploads so the listing can be validated
      // against its real images.
      if (submit && propertyId) {
        const submitRes = await fetch(`/api/properties/${propertyId}/submit`, {
          method: "POST",
        });
        const submitData = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok) {
          setError(
            submitData.error ||
              "Unable to submit property. Please try again.",
          );
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
      setError(
        err?.message ||
          (submit
            ? "Unable to submit property. Please try again."
            : "Something went wrong."),
      );
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
          {STEPS.map((label, index) => {
            const isActive = step === index;
            // Only mark steps the user has already passed, and that still validate.
            const isComplete = index < step && isStepComplete(index);
            return (
              <button
                key={label}
                type="button"
                className={`${ui.stepPill} ${isActive ? ui.stepPillActive : ""} ${isComplete ? ui.stepPillCompleted : ""}`}
                aria-current={isActive ? "step" : undefined}
                onClick={() => handleStepClick(index)}
              >
                {index + 1}. {label}
              </button>
            );
          })}
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
              <span className={ui.label}>
                Title
                <RequiredMark />
              </span>
              <input
                className={`${ui.input} ${fieldErrors.title ? ui.inputInvalid : ""}`}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="10 Marla House in DHA Phase 5"
                maxLength={WIZARD_TEXT_LIMITS.title}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby="title-error"
              />
              <FieldMessage id="title-error" error={fieldErrors.title} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>
                Property type
                <RequiredMark />
              </span>
              <select
                className={`${ui.select} ${fieldErrors.propertyType ? ui.inputInvalid : ""}`}
                value={form.propertyType}
                onChange={(e) => update("propertyType", e.target.value)}
                aria-invalid={Boolean(fieldErrors.propertyType)}
                aria-describedby="propertyType-error"
              >
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
                <option value="plot">Plot</option>
              </select>
              <FieldMessage
                id="propertyType-error"
                error={fieldErrors.propertyType}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>
                Property subtype
                <RequiredMark />
              </span>
              <select
                className={`${ui.select} ${fieldErrors.propertySubtype ? ui.inputInvalid : ""}`}
                value={form.propertySubtype}
                onChange={(e) => update("propertySubtype", e.target.value)}
                aria-invalid={Boolean(fieldErrors.propertySubtype)}
                aria-describedby="propertySubtype-error"
              >
                <option value="">Select subtype</option>
                {subtypesForType(form.propertyType).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldMessage
                id="propertySubtype-error"
                error={fieldErrors.propertySubtype}
              />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Description</span>
              <textarea
                className={`${ui.textarea} ${fieldErrors.description ? ui.inputInvalid : ""}`}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Describe the property"
                maxLength={WIZARD_TEXT_LIMITS.description}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby="description-error"
              />
              <FieldMessage
                id="description-error"
                error={fieldErrors.description}
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className={ui.field}>
              <span className={ui.label}>
                City
                <RequiredMark />
              </span>
              <input
                className={`${ui.input} ${fieldErrors.city ? ui.inputInvalid : ""}`}
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="e.g. Lahore"
                maxLength={WIZARD_TEXT_LIMITS.city}
                aria-invalid={Boolean(fieldErrors.city)}
                aria-describedby="city-error"
              />
              <FieldMessage id="city-error" error={fieldErrors.city} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Area</span>
              <input
                className={`${ui.input} ${fieldErrors.area ? ui.inputInvalid : ""}`}
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
                placeholder="e.g. DHA,Gulberg"
                maxLength={WIZARD_TEXT_LIMITS.area}
                aria-invalid={Boolean(fieldErrors.area)}
                aria-describedby="area-error"
              />
              <FieldMessage id="area-error" error={fieldErrors.area} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>Phase/Sector</span>
              <input
                className={`${ui.input} ${fieldErrors.phase ? ui.inputInvalid : ""}`}
                value={form.phase}
                onChange={(e) => update("phase", e.target.value)}
                placeholder="e.g. Phase 6 / Sector B"
                maxLength={WIZARD_TEXT_LIMITS.phase}
                aria-invalid={Boolean(fieldErrors.phase)}
                aria-describedby="phase-error"
              />
              <FieldMessage id="phase-error" error={fieldErrors.phase} />
            </label>
            <label className={ui.field}>
              <span className={ui.label}>
                Address
                <RequiredMark />
              </span>
              <input
                className={`${ui.input} ${fieldErrors.address ? ui.inputInvalid : ""}`}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="House number, street, block, road, full address"
                maxLength={WIZARD_TEXT_LIMITS.address}
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby="address-error"
              />
              <FieldMessage id="address-error" error={fieldErrors.address} />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>
                  Size
                  <RequiredMark />
                </span>
                <input
                  className={`${ui.input} ${fieldErrors.size_value ? ui.inputInvalid : ""}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.size_value}
                  onChange={(e) => update("size_value", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.size_value)}
                  aria-describedby="size-error"
                />
                <FieldMessage id="size-error" error={fieldErrors.size_value} />
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
                <FieldMessage />
              </label>
            </div>
            <div className={ui.row2}>
              <label className={ui.field}>
                <span className={ui.label}>Bedrooms</span>
                <input
                  className={`${ui.input} ${fieldErrors.bedrooms ? ui.inputInvalid : ""}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.bedrooms}
                  onChange={(e) => update("bedrooms", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.bedrooms)}
                  aria-describedby="bedrooms-error"
                />
                <FieldMessage
                  id="bedrooms-error"
                  error={fieldErrors.bedrooms}
                />
              </label>
              <label className={ui.field}>
                <span className={ui.label}>Bathrooms</span>
                <input
                  className={`${ui.input} ${fieldErrors.bathrooms ? ui.inputInvalid : ""}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.bathrooms}
                  onChange={(e) => update("bathrooms", e.target.value)}
                  aria-invalid={Boolean(fieldErrors.bathrooms)}
                  aria-describedby="bathrooms-error"
                />
                <FieldMessage
                  id="bathrooms-error"
                  error={fieldErrors.bathrooms}
                />
              </label>
            </div>
            <div className={ui.row2}>
              <div className={`${ui.field} ${ui.parkingField}`}>
                {/* Spacer matches Price label row so the toggle lines up with the input. */}
                <span className={ui.parkingLabelSpacer} aria-hidden="true" />
                <div className={ui.parkingInline}>
                  <span className={ui.label}>Parking</span>
                  <div className={ui.parkingControl}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.parking === "Yes"}
                      aria-label="Parking available"
                      className={`${ui.parkingSwitch} ${form.parking === "Yes" ? ui.parkingSwitchOn : ""}`}
                      onClick={() =>
                        update(
                          "parking",
                          form.parking === "Yes" ? "No" : "Yes",
                        )
                      }
                    >
                      <span className={ui.parkingThumb} aria-hidden="true" />
                    </button>
                    <div className={ui.parkingScale} aria-hidden="true">
                      <span>No</span>
                      <span>Yes</span>
                    </div>
                  </div>
                </div>
                <FieldMessage />
              </div>
              <div className={ui.field}>
                <span className={ui.label}>
                  Price
                  <RequiredMark />
                </span>
                <PriceCurrencyInput
                  amount={form.price}
                  currency={form.price_currency}
                  onAmountChange={(value) => update("price", value)}
                  onCurrencyChange={(value) => update("price_currency", value)}
                  invalid={Boolean(fieldErrors.price)}
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby="price-error"
                />
                <FieldMessage id="price-error" error={fieldErrors.price} />
              </div>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <span className={ui.label}>
              Property Images
              <RequiredMark />
            </span>
            <FieldMessage id="images-error" error={fieldErrors.images} />

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
                          <span className={ui.imageCardLabel}>
                            Category
                            <RequiredMark />
                          </span>
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
                          <label className={ui.imageCardCheck}>
                            <input
                              type="checkbox"
                              checked={Boolean(item.isFeatured || item.heroDisplay)}
                              disabled={Boolean(item.isFeatured)}
                              onChange={() =>
                                updateImage(index, {
                                  heroDisplay: !item.heroDisplay,
                                })
                              }
                            />
                            Display on hero
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
            <FieldMessage id="videos-error" error={fieldErrors.videos} />

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
                        <PropertyWatermark text={watermarkText} compact />
                        {item.isFeatured ? (
                          <span className={ui.featuredTag}>Featured</span>
                        ) : null}
                      </div>
                      <div className={ui.imageCardBody}>
                        <label className={ui.field}>
                          <span className={ui.imageCardLabel}>
                            Category
                            <RequiredMark />
                          </span>
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
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
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
                Upload MP4, WebM, MOV videos. Maximum 5 videos allowed.
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
              title, property type, city, address, size, price, and at least
              one image.
            </p>
            <PropertyMarketingSectionsEditor form={form} setForm={setForm} />
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
                onClick={handleBack}
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
