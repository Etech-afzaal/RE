"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import PasswordInput from "@/components/PasswordInput";
import ui from "@/components/agent-portal/portal.module.css";

export default function AgentSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const username = decodeURIComponent(params.estate_name || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (status === "unauthenticated") {
    router.replace("/agent/login");
  }

  async function changePassword(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/agents/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not update password.");
      return;
    }
    setPassword("");
    setConfirm("");
    setSuccess("Password updated.");
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
