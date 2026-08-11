"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import PasswordInput from "@/components/PasswordInput";
import ui from "@/components/agent-portal/portal.module.css";
import { validateNewPassword } from "@/lib/validators/userValidator";

export default function AgentSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <LoadingSpinner
        fullPage
        label="Loading"
        hint="Preparing your workspace…"
      />
    );
  }

  async function changePassword(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    const passwordCheck = validateNewPassword(password);
    if (!passwordCheck.ok) {
      setError(passwordCheck.error);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/agents/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword: passwordCheck.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update password.");
        return;
      }
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setSuccess("Password updated.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Settings"
      subtitle="Account security and preferences"
    >
      <form className={ui.formCard} onSubmit={changePassword}>
        <h2 className={ui.panelTitle} style={{ marginBottom: "1rem" }}>
          Change password
        </h2>
        {error ? <p className={ui.error}>{error}</p> : null}
        {success ? <p className={ui.success}>{success}</p> : null}
        <label className={ui.field}>
          <span className={ui.label}>Current password</span>
          <PasswordInput
            className={ui.input}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>New password</span>
          <PasswordInput
            className={ui.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Confirm password</span>
          <PasswordInput
            className={ui.input}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <div className={ui.formActions}>
          <button type="submit" className={ui.btnPrimary} disabled={saving}>
            {saving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </AgentPortalShell>
  );
}
