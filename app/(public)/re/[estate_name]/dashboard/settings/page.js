"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Copy } from "lucide-react";
import AgentPortalShell from "@/components/agent-portal/AgentPortalShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import PasswordInput from "@/components/PasswordInput";
import ui from "@/components/agent-portal/portal.module.css";
import { validateNewPassword } from "@/lib/validators/userValidator";
import {
  defaultWebsiteListingPreferences,
  WEBSITE_LISTING_PREF_OPTIONS,
} from "@/lib/websiteListingPreferences";

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
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [domainCopied, setDomainCopied] = useState(false);

  const [prefs, setPrefs] = useState(defaultWebsiteListingPreferences);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState("");
  const [prefsSuccess, setPrefsSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/agent/login");
    }
  }, [status, router]);

  useEffect(() => {
    setWebsiteUrl(
      `${window.location.origin}/re/${encodeURIComponent(username)}`,
    );
  }, [username]);

  async function copyWebsiteUrl() {
    if (!websiteUrl) return;
    try {
      await navigator.clipboard.writeText(websiteUrl);
      setDomainCopied(true);
      window.setTimeout(() => setDomainCopied(false), 1800);
    } catch {
      setDomainCopied(false);
    }
  }

  const loadPreferences = useCallback(async () => {
    setPrefsLoading(true);
    setPrefsError("");
    try {
      const res = await fetch("/api/agent/website-listing-preferences");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPrefsError(data.error || "Could not load listing preferences.");
        setPrefs(defaultWebsiteListingPreferences());
        return;
      }
      setPrefs(data.preferences || defaultWebsiteListingPreferences());
    } catch {
      setPrefsError("Network error. Please try again.");
      setPrefs(defaultWebsiteListingPreferences());
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadPreferences();
    }
  }, [status, loadPreferences]);

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

  function toggleCategory(type, enabled) {
    setPrefs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled,
      },
    }));
    setPrefsSuccess("");
  }

  function toggleSubtype(type, subtype, enabled) {
    setPrefs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        types: {
          ...prev[type].types,
          [subtype]: enabled,
        },
      },
    }));
    setPrefsSuccess("");
  }

  async function saveListingPreferences(e) {
    e.preventDefault();
    setPrefsError("");
    setPrefsSuccess("");
    setPrefsSaving(true);
    try {
      const res = await fetch("/api/agent/website-listing-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPrefsError(data.error || "Could not save preferences.");
        return;
      }
      if (data.preferences) setPrefs(data.preferences);
      setPrefsSuccess("Website listing preferences saved.");
    } catch {
      setPrefsError("Network error. Please try again.");
    } finally {
      setPrefsSaving(false);
    }
  }

  return (
    <AgentPortalShell
      username={username}
      agentName={session?.user?.name}
      title="Settings"
      subtitle="Account security and preferences"
    >
      <div className={ui.settingsStack}>
        <section className={ui.formCard}>
          <h2 className={ui.panelTitle} style={{ marginBottom: "0.35rem" }}>
            Your Website Domain
          </h2>
          <p className={ui.settingsLead}>
            Your public website URL
          </p>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="public-site-url">
              Public site URL
            </label>
            <span className={ui.domainFieldRow}>
              <input
                id="public-site-url"
                type="text"
                className={`${ui.input} ${ui.domainInput}`}
                value={websiteUrl}
                readOnly
                aria-label="Your public website URL"
              />
              <button
                type="button"
                className={ui.domainCopyButton}
                onClick={copyWebsiteUrl}
                disabled={!websiteUrl}
                aria-label={domainCopied ? "Website URL copied" : "Copy website URL"}
                title={domainCopied ? "Copied" : "Copy URL"}
              >
                {domainCopied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </span>
          </div>
          <span className={ui.copyStatus} role="status" aria-live="polite">
            {domainCopied ? "Website URL copied" : ""}
          </span>
        </section>

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

        <form className={ui.formCard} onSubmit={saveListingPreferences}>
          <h2 className={ui.panelTitle} style={{ marginBottom: "0.35rem" }}>
            Website Menu Preferences
          </h2>
          <p className={ui.settingsLead}>
            Choose what appears on your public website
          </p>
          {prefsError ? <p className={ui.error}>{prefsError}</p> : null}
          {prefsSuccess ? <p className={ui.success}>{prefsSuccess}</p> : null}

          {prefsLoading ? (
            <p className={ui.settingsMuted}>Loading preferences…</p>
          ) : (
            <div className={ui.prefGroups}>
              {WEBSITE_LISTING_PREF_OPTIONS.map((group) => {
                const category = prefs[group.type];
                const parentEnabled = Boolean(category?.enabled);
                return (
                  <div key={group.type} className={ui.prefGroup}>
                    <label className={ui.prefParent}>
                      <input
                        type="checkbox"
                        checked={parentEnabled}
                        onChange={(e) =>
                          toggleCategory(group.type, e.target.checked)
                        }
                      />
                      <span>{group.label}</span>
                    </label>
                    <div className={ui.prefChildren}>
                      {group.subtypes.map((child) => (
                        <label
                          key={child.subtype}
                          className={`${ui.prefChild}${
                            parentEnabled ? "" : ` ${ui.prefChildDisabled}`
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(
                              category?.types?.[child.subtype],
                            )}
                            disabled={!parentEnabled}
                            onChange={(e) =>
                              toggleSubtype(
                                group.type,
                                child.subtype,
                                e.target.checked,
                              )
                            }
                          />
                          <span>{child.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={ui.formActions}>
            <button
              type="submit"
              className={ui.btnPrimary}
              disabled={prefsSaving || prefsLoading}
            >
              {prefsSaving ? "Saving…" : "Save Menu"}
            </button>
          </div>
        </form>
      </div>
    </AgentPortalShell>
  );
}
