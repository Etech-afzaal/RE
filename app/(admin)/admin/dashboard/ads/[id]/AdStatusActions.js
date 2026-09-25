"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdsDialog from "../AdsDialog";
import styles from "../ads.module.css";

export default function AdStatusActions({ ad, notice = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Warning passed back after a save (e.g. "Saved, but the ad was turned OFF").
  const [showNotice, setShowNotice] = useState(Boolean(notice));
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function setStatus(status) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not update the ad.");
    } finally {
      setBusy(false);
    }
  }

  const isOn = ad.status === "active";
  const archived = ad.status === "archived";

  return (
    <div>
      <div className={styles.buttonRow}>
        {!archived && (
          <>
            <span className={styles.label}>{isOn ? "ON" : "OFF"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              aria-label={isOn ? "Turn ad off" : "Turn ad on"}
              className={`${styles.switch} ${isOn ? styles.switchOn : ""}`}
              disabled={busy}
              onClick={() => setStatus(isOn ? "paused" : "active")}
            />
            <Link href={`/admin/dashboard/ads/${ad.id}/edit`} className={styles.buttonSecondary}>
              Edit
            </Link>
            <button
              type="button"
              className={styles.buttonDanger}
              disabled={busy}
              onClick={() => setConfirmArchive(true)}
            >
              Archive
            </button>
          </>
        )}
        {archived && (
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={busy}
            onClick={() => setStatus("paused")}
          >
            Restore (as OFF)
          </button>
        )}
      </div>
      {error && (
        <AdsDialog
          title={`Couldn't turn the ad ${isOn ? "OFF" : "ON"}`}
          message={error}
          onClose={() => setError("")}
        />
      )}
      {confirmArchive && (
        <AdsDialog
          title="Archive this ad?"
          message={`“${ad.title}” will stop serving and move to archived ads. Its stats and payment notes are kept, and you can restore it later.`}
          closeLabel="Cancel"
          action={{
            label: "Archive ad",
            tone: "danger",
            onClick: () => {
              setConfirmArchive(false);
              setStatus("archived");
            },
          }}
          onClose={() => setConfirmArchive(false)}
        />
      )}
      {showNotice && (
        <AdsDialog
          title={notice.includes("turned OFF") ? "Saved — but the ad is OFF" : "Saved"}
          message={notice}
          onClose={() => {
            setShowNotice(false);
            router.replace(`/admin/dashboard/ads/${ad.id}`);
          }}
        />
      )}
    </div>
  );
}
