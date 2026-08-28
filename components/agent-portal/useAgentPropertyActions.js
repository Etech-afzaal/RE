"use client";

import { useState } from "react";

export function useAgentPropertyActions({ onReload, getReloadPage }) {
  const [busyId, setBusyId] = useState(null);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [propertyToCancelApproval, setPropertyToCancelApproval] = useState(null);
  const [propertyForLinks, setPropertyForLinks] = useState(null);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState("");

  function clearMessages() {
    setError("");
    setErrorDetails([]);
    setSuccess("");
  }

  async function markAsSold(property) {
    setBusyId(property.id);
    clearMessages();
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sold" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not mark this property as sold.");
        return;
      }
      setSuccess("Property marked as sold.");
      await onReload?.();
    } catch {
      setError("Could not mark this property as sold.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitForApproval(property) {
    setBusyId(property.id);
    clearMessages();
    try {
      const res = await fetch(`/api/properties/${property.id}/submit`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit this property for approval.");
        setErrorDetails(Array.isArray(data.errors) ? data.errors : []);
        return;
      }
      setSuccess("Property submitted for approval.");
      await onReload?.();
    } catch {
      setError("Could not submit this property for approval.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelApprovalRequest() {
    if (!propertyToCancelApproval) return;

    const property = propertyToCancelApproval;
    setBusyId(property.id);
    clearMessages();
    try {
      const res = await fetch(
        `/api/properties/${property.id}/cancel-approval`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not cancel this approval request.");
        return;
      }
      setPropertyToCancelApproval(null);
      setSuccess("Approval request cancelled. Property returned to draft.");
      await onReload?.();
    } catch {
      setError("Could not cancel this approval request.");
    } finally {
      setBusyId(null);
    }
  }

  async function addToFeatured(property) {
    setBusyId(property.id);
    clearMessages();
    try {
      const res = await fetch(`/api/properties/${property.id}/featured`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not add this property to featured.");
        return;
      }
      setSuccess(
        data.already_featured
          ? "Property is already featured."
          : "Property added to featured.",
      );
      await onReload?.();
    } catch {
      setError("Could not add this property to featured.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFromFeatured(property) {
    setBusyId(property.id);
    clearMessages();
    try {
      const res = await fetch(`/api/properties/${property.id}/featured`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove this property from featured.");
        return;
      }
      setSuccess("Property removed from featured.");
      await onReload?.();
    } catch {
      setError("Could not remove this property from featured.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProperty() {
    if (!propertyToDelete) return;

    const id = propertyToDelete.id;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete this property.");
      }

      setPropertyToDelete(null);
      setSuccess("Property deleted successfully.");
      const page = getReloadPage?.();
      await onReload?.(page);
    } catch (err) {
      setError(err.message || "Could not delete this property.");
    } finally {
      setBusyId(null);
    }
  }

  function openLinks(property) {
    clearMessages();
    setPropertyForLinks(property);
  }

  function openDelete(property) {
    clearMessages();
    setPropertyToDelete(property);
  }

  function openCancelApproval(property) {
    clearMessages();
    setPropertyToCancelApproval(property);
  }

  return {
    busyId,
    propertyToDelete,
    propertyToCancelApproval,
    propertyForLinks,
    error,
    errorDetails,
    success,
    setPropertyToDelete,
    setPropertyToCancelApproval,
    setPropertyForLinks,
    markAsSold,
    submitForApproval,
    cancelApprovalRequest,
    addToFeatured,
    removeFromFeatured,
    deleteProperty,
    openLinks,
    openDelete,
    openCancelApproval,
  };
}
