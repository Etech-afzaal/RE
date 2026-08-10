"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import PasswordInput from "@/components/PasswordInput";
import { validateNewPassword } from "@/lib/validators/userValidator";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const passwordCheck = validateNewPassword(newPassword);
    if (!passwordCheck.ok) {
      setError(passwordCheck.error);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/agents/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: passwordCheck.value }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update password.");
      return;
    }

    setDone(true);

    setTimeout(() => {
      signOut({ callbackUrl: "/agent/login" });
    }, 1500);
  }

  if (done) {
    return (
      <div
        className="reset-page"
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
          padding: "24px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#e8f4ff",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            ✓
          </div>
          <h1
            style={{
              margin: "0 0 10px",
              color: "#0f172a",
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
            }}
          >
            Password updated
          </h1>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
            Redirecting you to log in with your new password...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="reset-page"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)",
        padding: "24px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style jsx global>{`
        @media (max-width: 700px) {
          .reset-page {
            padding: 16px 12px !important;
          }
          .reset-page .reset-card {
            padding: 18px 14px !important;
          }
          .reset-page .reset-btn {
            width: 100%;
          }
        }
      `}</style>

      <div
        className="reset-card"
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
          padding: "28px 24px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 999,
            background: "#ecf6ff",
            color: "#2563eb",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          Security step
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            color: "#0f172a",
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            lineHeight: 1.2,
          }}
        >
          Set a new password
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            color: "#475569",
            fontSize: "1rem",
            lineHeight: 1.7,
          }}
        >
          For your security, please choose a strong new password before
          continuing.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <PasswordInput
            required
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
          />
          <PasswordInput
            required
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
          />
          {error && (
            <p style={{ margin: 0, color: "#dc2626", fontSize: 14 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="reset-btn"
            style={{
              border: "none",
              borderRadius: 999,
              padding: "13px 18px",
              fontSize: 15,
              fontWeight: 700,
              color: "#fff",
              cursor: loading ? "wait" : "pointer",
              background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
              boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)",
              marginTop: 4,
            }}
          >
            {loading ? "Saving..." : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  background: "#f8fbff",
  color: "#0f172a",
};
