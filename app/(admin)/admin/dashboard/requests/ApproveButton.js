"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ApproveButton.module.css";

export default function RequestActions({ request }) {
  const router = useRouter();
  const [status, setStatus] = useState(request.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setStatus(
        action === "approve" || action === "grant" ? "approved" : "revoked",
      );
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Action failed.");
    }
  }

  return (
    <div>
      {status === "pending" && (
        <button
          onClick={() => handleAction("approve")}
          disabled={loading}
          className={`${styles.actionBtn} ${styles.actionPrimary}`}
        >
          {loading ? "Approving..." : "Approve & send credentials"}
        </button>
      )}

      {status === "approved" && (
        <button
          onClick={() => handleAction("revoke")}
          disabled={loading}
          className={`${styles.actionBtn} ${styles.actionDanger}`}
        >
          {loading ? "Revoking..." : "Revoke access"}
        </button>
      )}

      {status === "revoked" && (
        <button
          onClick={() => handleAction("grant")}
          disabled={loading}
          className={`${styles.actionBtn} ${styles.actionSuccess}`}
        >
          {loading ? "Granting..." : "Grant access"}
        </button>
      )}

      {status === "rejected" && (
        <span className={styles.actionMessage}>Request rejected</span>
      )}

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
