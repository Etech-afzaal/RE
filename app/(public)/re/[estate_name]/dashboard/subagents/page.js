"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import AgentAvatar from "@/components/AgentAvatar";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import ui from "@/components/agent-portal/portal.module.css";
import styles from "./page.module.css";
import {
  IMAGE_KINDS,
  imageProcessErrorMessage,
  profileImageSizeErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { compressImageForUpload } from "@/lib/clientImageCompress";
import {
  normalizeSubagentDescriptionInput,
  normalizeSubagentEmailInput,
  normalizeSubagentNameInput,
  normalizeSubagentPhoneInput,
  validateSubagentInput,
} from "@/lib/validators/subagentValidator";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  secondary_phone: "",
  whatsapp_number: "",
  description: "",
  image: null,
};

const PAGE_SIZE = 10;

export default function AgentSubagentsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const base = `/re/${encodeURIComponent(username)}/dashboard`;

  const [subagents, setSubagents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSubagents, setTotalSubagents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [successPopup, setSuccessPopup] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const listSectionRef = useRef(null);
  const shouldScrollRef = useRef(false);

  const loadSubagents = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/agent/subagents?page=${page}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not load subagents.");
      }
      setSubagents(Array.isArray(data.subagents) ? data.subagents : []);
      setCurrentPage(data.currentPage || 1);
      setTotalSubagents(Number(data.totalSubagents) || 0);
      setTotalPages(Number(data.totalPages) || 1);
    } catch (err) {
      setError(err.message || "Could not load subagents.");
    } finally {
      setLoading(false);
    }
  }, []);

  function getReloadPage() {
    return subagents.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
  }

  function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    shouldScrollRef.current = true;
    loadSubagents(page);
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
      return;
    }
    if (status === "authenticated") loadSubagents(1);
  }, [status, router, loadSubagents]);

  useEffect(() => {
    if (!loading && shouldScrollRef.current) {
      shouldScrollRef.current = false;
      listSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [loading, subagents]);

  useEffect(() => {
    if (!successPopup) return undefined;
    const timer = window.setTimeout(() => setSuccessPopup(""), 2000);
    return () => window.clearTimeout(timer);
  }, [successPopup]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview(null);
      return undefined;
    }
    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImage]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSelectedImage(null);
    setImageError("");
    setShowForm(true);
    setError("");
    setSuccess("");
    setSuccessPopup("");
  }

  function openEdit(subagent) {
    setEditingId(subagent.id);
    setForm({
      name: subagent.name || "",
      email: subagent.email || "",
      phone: subagent.phone || "",
      secondary_phone: subagent.secondary_phone || "",
      whatsapp_number: subagent.whatsapp_number || "",
      description: subagent.description || "",
      image: subagent.image || null,
    });
    setSelectedImage(null);
    setImageError("");
    setShowForm(true);
    setError("");
    setSuccess("");
    setSuccessPopup("");
  }

  async function selectImage(file) {
    if (!file) return;
    setImageError("");
    setError("");

    const validated = validateImageUploadFile(file, IMAGE_KINDS.PROFILE);
    if (!validated.ok) {
      setImageError(validated.error);
      return;
    }

    try {
      const compressed = await compressImageForUpload(file);
      const afterCompress = validateImageUploadFile(compressed, IMAGE_KINDS.PROFILE);
      if (!afterCompress.ok) {
        setImageError(afterCompress.error);
        return;
      }
      setSelectedImage(compressed);
      setImageError("");
    } catch (err) {
      const message = String(err?.message || "").trim();
      setImageError(
        message && message !== "Error"
          ? message
          : imageProcessErrorMessage(),
      );
    }
  }

  function clearPendingImage() {
    setSelectedImage(null);
    setForm((prev) => ({ ...prev, image: null }));
    setImageError("");
    setError("");
  }

  const hasFormImage = Boolean(selectedImage || form.image);

  async function saveSubagent(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setImageError("");
    setSuccess("");
    setSuccessPopup("");

    const validated = validateSubagentInput(form);
    if (!validated.ok) {
      setSaving(false);
      setError(validated.error);
      return;
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/agent/subagents/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validated.data,
            image: form.image,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not update subagent.");
        }

        if (selectedImage) {
          const fd = new FormData();
          fd.append("image", selectedImage);
          const imageRes = await fetch(
            `/api/agent/subagents/${editingId}/image`,
            { method: "POST", body: fd },
          );
          const imageData = await imageRes.json().catch(() => ({}));
          if (!imageRes.ok) {
            setImageError(
              imageData.error || profileImageSizeErrorMessage(),
            );
            throw new Error(
              imageData.error || "Subagent saved but image upload failed.",
            );
          }
        }

        setSuccessPopup("Subagent updated");
      } else {
        const res = await fetch("/api/agent/subagents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...validated.data,
            image: null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not create subagent.");
        }

        const newId = data.id;

        if (selectedImage) {
          const fd = new FormData();
          fd.append("image", selectedImage);
          const imageRes = await fetch(`/api/agent/subagents/${newId}/image`, {
            method: "POST",
            body: fd,
          });
          const imageData = await imageRes.json().catch(() => ({}));
          if (!imageRes.ok) {
            setImageError(
              imageData.error || profileImageSizeErrorMessage(),
            );
            throw new Error(
              imageData.error || "Subagent created but image upload failed.",
            );
          }
        }

        setSuccess("Subagent created.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSelectedImage(null);
      await loadSubagents(editingId ? currentPage : 1);
    } catch (err) {
      setError(err.message || "Could not save subagent.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/agent/subagents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete subagent.");
      }
      setDeleteTarget(null);
      setSuccess("Subagent removed.");
      await loadSubagents(getReloadPage());
    } catch (err) {
      setError(err.message || "Could not delete subagent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Subagents"
      subtitle="Marketing representatives for tracked property links"
      action={
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={loading}
          onClick={openCreate}
        >
          Add Subagent
        </button>
      }
    >
      {error ? <p className={ui.error}>{error}</p> : null}
      {success ? <p className={ui.success}>{success}</p> : null}

      <div
        className={`${ui.panel} ${
          !loading && subagents.length > 0 ? styles.listingPanel : ""
        }`}
        ref={listSectionRef}
      >
        {loading ? (
          <LoadingSpinner
            fullPage={false}
            label="Loading"
            hint="Fetching subagents…"
          />
        ) : totalSubagents === 0 ? (
          <p className={ui.empty}>
            No subagents yet. Add marketing representatives.
          </p>
        ) : (
          <>
            <p className={ui.paginationCount}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;
              {Math.min(currentPage * PAGE_SIZE, totalSubagents)} of{" "}
              {totalSubagents} subagents
            </p>
            <div className={`${ui.tableWrap} ${styles.tableArea}`}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Representative</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subagents.map((subagent) => (
                    <tr key={subagent.id}>
                      <td data-label="Representative">
                        <div className={ui.propCell}>
                          <AgentAvatar
                            src={subagent.image}
                            alt=""
                            width={40}
                            height={40}
                          />
                          <div>
                            <p className={ui.propTitle}>{subagent.name}</p>
                            {subagent.description ? (
                              <p className={ui.propMeta}>
                                {subagent.description.slice(0, 60)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td data-label="Email">{subagent.email}</td>
                      <td data-label="Phone">{subagent.phone}</td>
                      <td data-label="Actions">
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={ui.btnGhost}
                            onClick={() => openEdit(subagent)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => setDeleteTarget(subagent)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>
            <div className={styles.paginationSlot}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={changePage}
                ariaLabel="Subagents pagination"
              />
            </div>
          </>
        )}
      </div>

      {showForm ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={`${ui.dialog} ${styles.formDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="subagent-form-title"
          >
            <h2
              id="subagent-form-title"
              className={`${ui.dialogTitle} ${styles.dialogTitle}`}
            >
              {editingId ? "Edit Subagent" : "Add Subagent"}
            </h2>
            <form className={styles.dialogForm} onSubmit={saveSubagent}>
              {error ? (
                <p className={`${ui.error} ${styles.dialogError}`}>{error}</p>
              ) : null}
              <div className={styles.formLayout}>
                <div className={styles.formAside}>
                  <div className={`${ui.brandAssetRow} ${styles.imageSection}`}>
                    <div
                      className={`${ui.brandAssetPreview} ${ui.brandAssetPreviewRound}`}
                    >
                      <AgentAvatar
                        src={imagePreview || form.image}
                        alt=""
                        width={72}
                        height={72}
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                      {hasFormImage ? (
                        <button
                          type="button"
                          className={ui.brandAssetRemove}
                          aria-label="Remove picture"
                          disabled={saving}
                          onClick={clearPendingImage}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                    <label className={ui.btnGhost} style={{ cursor: "pointer" }}>
                      Upload image
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
                  </div>
                  <p className={`${ui.propMeta} ${styles.imageHint}`}>
                    JPG, PNG or WEBP. Maximum size 2 MB.
                  </p>
                  {imageError ? (
                    <p className={ui.fieldError} role="alert">{imageError}</p>
                  ) : null}
                </div>

                <div className={styles.formFields}>
              <label className={`${ui.field} ${styles.field}`}>
                <span className={ui.label}>Name</span>
                <input
                  className={ui.input}
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: normalizeSubagentNameInput(e.target.value),
                    })
                  }
                  placeholder="Full name"
                  maxLength={30}
                  required
                />
              </label>
              <label className={`${ui.field} ${styles.field}`}>
                <span className={ui.label}>Email</span>
                <input
                  type="email"
                  className={ui.input}
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: normalizeSubagentEmailInput(e.target.value),
                    })
                  }
                  placeholder="you@example.com"
                  maxLength={50}
                  required
                />
              </label>
              <label className={`${ui.field} ${styles.field}`}>
                <span className={ui.label}>Phone</span>
                <input
                  className={ui.input}
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      phone: normalizeSubagentPhoneInput(e.target.value),
                    })
                  }
                  placeholder="+923001234567"
                  maxLength={16}
                  required
                />
              </label>
              <label className={`${ui.field} ${styles.field}`}>
                <span className={ui.label}>Second Number</span>
                <input
                  className={ui.input}
                  type="tel"
                  value={form.secondary_phone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      secondary_phone: normalizeSubagentPhoneInput(e.target.value),
                    })
                  }
                  placeholder="+923012345678"
                  maxLength={16}
                />
              </label>
              <label className={`${ui.field} ${styles.field}`}>
                <span className={ui.label}>WhatsApp Number</span>
                <input
                  className={ui.input}
                  type="tel"
                  value={form.whatsapp_number}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      whatsapp_number: normalizeSubagentPhoneInput(e.target.value),
                    })
                  }
                  placeholder="+923001234567"
                  maxLength={16}
                />
              </label>
              <label className={`${ui.field} ${styles.field} ${styles.fieldFull}`}>
                <span className={ui.label}>Description / Bio</span>
                <textarea
                  className={ui.textarea}
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: normalizeSubagentDescriptionInput(
                        e.target.value,
                      ),
                    })
                  }
                  placeholder="Optional short bio"
                  maxLength={500}
                  rows={2}
                />
              </label>
                </div>
              </div>

              <div className={`${ui.dialogActions} ${styles.dialogActions}`}>
                <button
                  type="button"
                  className={ui.btnGhost}
                  disabled={saving}
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={ui.btnPrimary}
                  disabled={saving}
                >
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {successPopup ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div
            className={`${ui.dialog} ${ui.dialogSuccess}`}
            role="status"
            aria-live="polite"
            aria-labelledby="subagent-success-title"
          >
            <div className={ui.dialogSuccessIcon} aria-hidden="true">
              ✓
            </div>
            <h2 id="subagent-success-title" className={ui.dialogTitle}>
              {successPopup}
            </h2>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={ui.dialogBackdrop} role="presentation">
          <div className={ui.dialog} role="dialog" aria-modal="true">
            <h2 className={ui.dialogTitle}>Delete Subagent?</h2>
            <p className={ui.dialogText}>
              &ldquo;{deleteTarget.name}&rdquo; will be archived. Historical
              marketing insights will remain available.
            </p>
            <div className={ui.dialogActions}>
              <button
                type="button"
                className={ui.btnGhost}
                disabled={saving}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={ui.btnDanger}
                disabled={saving}
                onClick={confirmDelete}
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p className={ui.propMeta} style={{ marginTop: 16 }}>
        Subagents are marketing profiles only — they cannot log in or manage
        properties.{" "}
        <Link href={`${base}/properties`}>Back to properties</Link>
      </p>
    </AgentPortalShell>
  );
}
