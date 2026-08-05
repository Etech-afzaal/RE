"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import styles from "./page.module.css";

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountNotice, setAccountNotice] = useState(null);

  useEffect(() => {
    if (!accountNotice) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAccountNotice(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [accountNotice]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAccountNotice(null);

    const res = await signIn("credentials", {
      email,
      password,
      role: "agent",
      redirect: false,
    });

    if (res?.error === "ACCOUNT_BLOCKED") {
      setLoading(false);
      let reason = "No reason was recorded.";
      try {
        const infoRes = await fetch("/api/agents/block-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const info = await infoRes.json().catch(() => ({}));
        if (info.blocked && info.reason) reason = info.reason;
      } catch {
        // Fall through with the default reason text.
      }
      setAccountNotice({
        title: "Account Permanently Blocked",
        body: "Your account has been blocked by the administrator.",
        reason,
        support:
          "Please contact support.",
      });
      return;
    }

    if (res?.error === "ACCOUNT_DISABLED") {
      setLoading(false);
      setAccountNotice({
        title: "Account Temporarily Disabled",
        body: "Your account is currently disabled. Please contact the administrator.",
      });
      return;
    }

    if (res?.error === "ACCOUNT_REVOKED") {
      setLoading(false);
      setError(
        "Your account access has been revoked. Contact the administrator to request access.",
      );
      return;
    }

    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    const session = await getSession();
    const handle =
      session?.user?.username || session?.user?.estate_name || null;
    setLoading(false);

    if (handle) {
      router.push(`/re/${encodeURIComponent(handle)}/adminarea`);
      return;
    }

    router.push("/agent/dashboard");
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginShell}>
        <div className={styles.loginCard}>
          <div className={styles.loginBadge}>Agent access</div>
          <h1 className={styles.loginTitle}>Welcome back</h1>
          <p className={styles.loginText}>
            Sign in to manage your listings, add new properties, and keep your
            public estate profile current.
          </p>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.loginInput}
            />
            <PasswordInput
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.loginInput}
              autoComplete="current-password"
            />
            <div className={styles.forgotRow}>
              <Link href="/agent/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className={styles.loginBtn}
            >
              {loading ? "Logging in..." : "Agent Log In"}
            </button>
          </form>

          <p className={styles.loginFooter}>
            New agent?{" "}
            <Link href="/agent/signup" className={styles.loginLink}>
              Create an account
            </Link>
          </p>
          <p className={styles.loginFooter}>
            Are you an admin?{" "}
            <Link href="/admin/login" className={styles.loginLink}>
              Use admin login
            </Link>
          </p>
        </div>

        <div className={styles.loginVisual}>
          <img
            src="/hero/1.jpg"
            alt="Luxury property"
            className={styles.loginVisualImg}
          />
          <div className={styles.loginVisualOverlay} aria-hidden="true" />
          <div className={styles.loginVisualText}>
            <h2 className={styles.loginVisualTitle}>Manage with confidence</h2>
            <ul className={styles.loginVisualList}>
              <li>Publish and update verified listings</li>
              <li>Keep your branded estate page current</li>
              <li>Respond to serious buyer inquiries</li>
            </ul>
          </div>
        </div>
      </div>

      {accountNotice ? (
        <div className={styles.noticeBackdrop} role="presentation">
          <div
            className={styles.noticeDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-notice-title"
          >
            <h2 id="account-notice-title" className={styles.noticeTitle}>
              {accountNotice.title}
            </h2>
            <p className={styles.noticeText}>{accountNotice.body}</p>
            {accountNotice.reason ? (
              <div className={styles.noticeReason}>
                <span className={styles.noticeReasonLabel}>Reason</span>
                {accountNotice.reason}
              </div>
            ) : null}
            {accountNotice.support ? (
              <p className={styles.noticeText}>{accountNotice.support}</p>
            ) : null}
            <button
              type="button"
              className={styles.loginBtn}
              onClick={() => setAccountNotice(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
