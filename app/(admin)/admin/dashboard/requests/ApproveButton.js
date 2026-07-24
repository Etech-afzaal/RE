"use client";

import { useEffect, useState } from "react";
import styles from "@/components/admin/adminUi.module.css";

export default function RequestActions({ request, onStatusChange }) {
  const [status, setStatus] = useState(request.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(request.status);
  }, [request.status]);

  async function handleAction(action) {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/agents/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id }),
    });

    setLoading(false);

    if (res.ok) {
      let nextStatus = "revoked";
      if (action === "approve" || action === "grant") nextStatus = "approved";
      if (action === "reject") nextStatus = "rejected";
      setStatus(nextStatus);
      onStatusChange?.(request.id, nextStatus);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed.");
    }
  }

  return (
    <div>
      <div className={styles.actions}>
        {status === "pending" && (
          <>
            <button
              type="button"
              onClick={() => handleAction("approve")}
              disabled={loading}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {loading ? "Working…" : "Approve & send credentials"}
            </button>
            <button
              type="button"
              onClick={() => handleAction("reject")}
              disabled={loading}
              className={`${styles.btn} ${styles.btnDanger}`}
            >
              Reject
            </button>
          </>
        )}

        {status === "approved" && (
          <button
            type="button"
            onClick={() => handleAction("revoke")}
            disabled={loading}
            className={`${styles.btn} ${styles.btnDanger}`}
          >
            {loading ? "Revoking…" : "Revoke access"}
          </button>
        )}

        {status === "revoked" && (
          <button
            type="button"
            onClick={() => handleAction("grant")}
            disabled={loading}
            className={`${styles.btn} ${styles.btnSuccess}`}
          >
            {loading ? "Granting…" : "Grant access"}
          </button>
        )}

        {status === "rejected" && (
          <span className={`${styles.badge} ${styles.badgeMuted}`}>
            Request rejected
          </span>
        )}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
